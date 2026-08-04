import { afterEach, describe, expect, it, vi } from "vitest"
import { installExpoCryptoRuntime } from "./InstallExpoCryptoRuntime"

const expoCryptoMocks = vi.hoisted(() => ({
  digest: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
  getRandomValues: vi.fn((typedArray: Uint8Array) => typedArray.fill(7)),
  randomUUID: vi.fn(() => "00000000-0000-4000-8000-000000000001"),
}))

vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: Object.freeze({ SHA256: "SHA-256" }),
  digest: expoCryptoMocks.digest,
  getRandomValues: expoCryptoMocks.getRandomValues,
  randomUUID: expoCryptoMocks.randomUUID,
}))

const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "crypto",
)

function replaceCryptoRuntime(value: unknown) {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value,
  })
}

describe("installExpoCryptoRuntime", () => {
  afterEach(() => {
    vi.clearAllMocks()
    if (originalCryptoDescriptor) {
      Object.defineProperty(globalThis, "crypto", originalCryptoDescriptor)
    } else {
      Reflect.deleteProperty(globalThis, "crypto")
    }
  })

  it("preserves a runtime that already supplies UUID and digest capabilities", () => {
    const existingRuntime = Object.freeze({
      randomUUID: vi.fn(),
      subtle: Object.freeze({ digest: vi.fn() }),
    })
    replaceCryptoRuntime(existingRuntime)

    installExpoCryptoRuntime()

    expect(globalThis.crypto).toBe(existingRuntime)
    expect(expoCryptoMocks.randomUUID).not.toHaveBeenCalled()
  })

  it.each([
    { label: "missing runtime", runtime: undefined },
    { label: "null runtime", runtime: null },
    { label: "missing UUID", runtime: { subtle: { digest: vi.fn() } } },
    {
      label: "missing subtle runtime",
      runtime: { randomUUID: vi.fn(), subtle: null },
    },
    {
      label: "missing digest",
      runtime: { randomUUID: vi.fn(), subtle: {} },
    },
  ])("installs Expo Crypto for a $label", ({ runtime }) => {
    replaceCryptoRuntime(runtime)

    installExpoCryptoRuntime()

    expect(globalThis.crypto.randomUUID()).toBe(
      "00000000-0000-4000-8000-000000000001",
    )
  })

  it("adapts Expo SHA-256 and secure random values to the shared runtime contract", async () => {
    replaceCryptoRuntime(undefined)
    installExpoCryptoRuntime()
    const sourceBytes = new TextEncoder().encode("wayvm")

    await expect(
      globalThis.crypto.subtle.digest("SHA-256", sourceBytes),
    ).resolves.toEqual(new Uint8Array([1, 2, 3]).buffer)
    await expect(
      globalThis.crypto.subtle.digest({ name: "SHA-256" }, sourceBytes),
    ).resolves.toEqual(new Uint8Array([1, 2, 3]).buffer)
    expect(globalThis.crypto.getRandomValues(new Uint8Array(2))).toEqual(
      new Uint8Array([7, 7]),
    )
    expect(expoCryptoMocks.digest).toHaveBeenCalledWith("SHA-256", sourceBytes)
  })

  it("rejects digest algorithms outside the shared SHA-256 contract", () => {
    replaceCryptoRuntime(undefined)
    installExpoCryptoRuntime()

    expect(() =>
      globalThis.crypto.subtle.digest(
        "SHA-512",
        new TextEncoder().encode("wayvm"),
      ),
    ).toThrow("The native runtime supports only SHA-256 digests")
  })
})

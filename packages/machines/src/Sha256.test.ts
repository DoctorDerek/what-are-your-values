import { describe, expect, it } from "vitest"
import { createSha256Hex } from "./Sha256"

describe("SHA-256", () => {
  it("matches the standard lowercase hexadecimal test vector", async () => {
    await expect(createSha256Hex("abc")).resolves.toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    )
  })
})

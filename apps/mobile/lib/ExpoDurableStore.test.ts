import { beforeEach, describe, expect, it, vi } from "vitest"
import { expoDurableStore } from "./ExpoDurableStore"

const asyncStorageMocks = vi.hoisted(() => ({
  getAllKeys: vi.fn<() => Promise<readonly string[]>>(),
  multiGet:
    vi.fn<
      (
        keys: readonly string[],
      ) => Promise<readonly (readonly [string, string | null])[]>
    >(),
  multiRemove: vi.fn<(keys: readonly string[]) => Promise<void>>(),
  multiSet:
    vi.fn<
      (keyValuePairs: readonly (readonly [string, string])[]) => Promise<void>
    >(),
}))

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: asyncStorageMocks,
}))

describe("expoDurableStore", () => {
  beforeEach(() => {
    asyncStorageMocks.getAllKeys.mockReset()
    asyncStorageMocks.multiGet.mockReset()
    asyncStorageMocks.multiRemove.mockReset()
    asyncStorageMocks.multiSet.mockReset()
  })

  it("binds the native durable-store singleton to AsyncStorage", async () => {
    asyncStorageMocks.getAllKeys.mockResolvedValue([
      "wayvm.snapshot.manifest",
      "another-app.preference",
    ])
    asyncStorageMocks.multiGet.mockResolvedValue([
      ["wayvm.snapshot.manifest", "manifest"],
    ])

    await expect(expoDurableStore.readAll()).resolves.toEqual(
      new Map([["wayvm.snapshot.manifest", "manifest"]]),
    )
    expect(asyncStorageMocks.multiGet).toHaveBeenCalledWith([
      "wayvm.snapshot.manifest",
    ])
  })
})

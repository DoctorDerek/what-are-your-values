import { MAX_PERSISTED_JSON_BYTES } from "@game/machines/src/PersistedJson"
import { playerDataPortabilityCopy } from "@game/machines/src/PlayerDataPortabilityCopy"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  downloadPlayerDataFile,
  readPlayerDataFile,
  WAYVM_IMPORT_FILE_ACCEPT,
} from "./PlayerDataFiles"

describe("Player Data Files", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("downloads canonical backup bytes with their prepared filename and releases the object URL", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:wayvm-backup")
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined)

    downloadPlayerDataFile({
      filename: "wayvm-backup.json",
      serialized: '["wayvm-export"]',
    })

    const backupBlob = createObjectURL.mock.calls[0]?.[0]
    expect(backupBlob).toBeInstanceOf(Blob)
    if (!(backupBlob instanceof Blob))
      throw new Error("Prepared browser download is not a Blob")
    await expect(backupBlob.text()).resolves.toBe('["wayvm-export"]')
    expect(backupBlob.type).toBe("application/json;charset=utf-8")
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:wayvm-backup")
    expect(document.querySelector('a[download="wayvm-backup.json"]')).toBeNull()
  })

  it("releases the object URL and temporary anchor when browser delivery fails", () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("Browser download failed")
    })
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:failed-backup")
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined)

    expect(() =>
      downloadPlayerDataFile({
        filename: "failed-backup.json",
        serialized: '["wayvm-export"]',
      }),
    ).toThrow("Browser download failed")
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:failed-backup")
    expect(
      document.querySelector('a[download="failed-backup.json"]'),
    ).toBeNull()
  })

  it("reads a bounded local JSON file without interpreting its contents", async () => {
    const file = new File(['["wayvm-export"]'], "wayvm-backup.json", {
      type: "application/json",
    })

    await expect(readPlayerDataFile(file)).resolves.toBe('["wayvm-export"]')
    expect(WAYVM_IMPORT_FILE_ACCEPT).toBe(".json,application/json")
  })

  it("accepts a declared file at the exact byte boundary", async () => {
    const file = {
      size: MAX_PERSISTED_JSON_BYTES,
      text: vi.fn().mockResolvedValue("[]"),
    } as unknown as File

    await expect(readPlayerDataFile(file)).resolves.toBe("[]")
  })

  it("rejects a declared file one byte over the limit before reading", async () => {
    const text = vi.fn<() => Promise<string>>()
    const file = {
      size: MAX_PERSISTED_JSON_BYTES + 1,
      text,
    } as unknown as File

    await expect(readPlayerDataFile(file)).rejects.toThrow(
      playerDataPortabilityCopy.importUnsafe,
    )
    expect(text).not.toHaveBeenCalled()
  })

  it("rejects decoded text whose actual UTF-8 bytes exceed the limit", async () => {
    const serialized = "🦝".repeat(MAX_PERSISTED_JSON_BYTES / 4 + 1)
    const file = {
      size: 0,
      text: vi.fn().mockResolvedValue(serialized),
    } as unknown as File

    await expect(readPlayerDataFile(file)).rejects.toThrow(
      playerDataPortabilityCopy.importUnsafe,
    )
  })

  it("normalizes browser read failures without exposing platform details", async () => {
    const file = {
      size: 1,
      text: vi.fn().mockRejectedValue(new Error("Access denied")),
    } as unknown as File

    await expect(readPlayerDataFile(file)).rejects.toThrow(
      playerDataPortabilityCopy.importInvalid,
    )
  })
})

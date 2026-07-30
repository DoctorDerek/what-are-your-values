import { MAX_PERSISTED_JSON_BYTES } from "@game/machines/src/PersistedJson"
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

  it("downloads canonical backup bytes with their prepared filename and releases the object URL", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:wayvm-backup")
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined)
    const createElement = vi.spyOn(document, "createElement")

    downloadPlayerDataFile({
      filename: "wayvm-backup.json",
      serialized: '["wayvm-export"]',
    })

    const downloadLink = createElement.mock.results.find(
      ({ value }) => value instanceof HTMLAnchorElement,
    )?.value
    expect(downloadLink).toMatchObject({
      href: "blob:wayvm-backup",
      download: "wayvm-backup.json",
    })
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:wayvm-backup")
  })

  it("reads a bounded local JSON file without interpreting its contents", async () => {
    const file = new File(['["wayvm-export"]'], "wayvm-backup.json", {
      type: "application/json",
    })

    await expect(readPlayerDataFile(file)).resolves.toBe('["wayvm-export"]')
    expect(WAYVM_IMPORT_FILE_ACCEPT).toBe(".json,application/json")
  })

  it("rejects oversized local files before reading their bytes", async () => {
    const text = vi.fn<() => Promise<string>>()
    const file = {
      size: MAX_PERSISTED_JSON_BYTES + 1,
      text,
    } as unknown as File

    await expect(readPlayerDataFile(file)).rejects.toThrow(
      "Backup file exceeds the 8 MiB import limit",
    )
    expect(text).not.toHaveBeenCalled()
  })
})

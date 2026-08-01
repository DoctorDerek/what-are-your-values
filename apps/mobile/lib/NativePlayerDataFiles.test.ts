import { MAX_PERSISTED_JSON_BYTES } from "@game/machines/src/PersistedJson"
import { describe, expect, it, vi } from "vitest"
import {
  createNativePlayerDataFileAdapter,
  type NativePlayerDataFileServices,
  type NativeReadableTextFile,
  type NativeTemporaryTextFile,
} from "./NativePlayerDataFiles"

const BACKUP_FILENAME =
  "what-are-your-values-mapache-backup-2026-08-01-123456Z.json"
const BACKUP_URI = `file:///cache/${BACKUP_FILENAME}`

function createReadableFile({
  serialized,
  size = new TextEncoder().encode(serialized).byteLength,
}: {
  readonly serialized: string
  readonly size?: number
}) {
  return Object.freeze({
    uri: BACKUP_URI,
    size,
    text: vi.fn(async () => serialized),
  }) satisfies NativeReadableTextFile
}

function createTemporaryFile({
  writtenText,
  reportedSize,
  readText,
  activity,
}: {
  readonly writtenText: { value: string }
  readonly reportedSize?: number
  readonly readText?: string
  readonly activity: string[]
}) {
  return Object.freeze({
    uri: BACKUP_URI,
    get size() {
      return (
        reportedSize ?? new TextEncoder().encode(writtenText.value).byteLength
      )
    },
    create: vi.fn(({ overwrite }) => {
      activity.push(`create:${String(overwrite)}`)
    }),
    delete: vi.fn(() => {
      activity.push("delete")
    }),
    write: vi.fn((content) => {
      activity.push("write")
      writtenText.value = content
    }),
    text: vi.fn(async () => {
      activity.push("read")
      return readText ?? writtenText.value
    }),
  }) satisfies NativeTemporaryTextFile
}

function createServices({
  selectedFile = null,
  sharingAvailable = true,
  temporaryFile,
  activity = [],
}: {
  readonly selectedFile?: NativeReadableTextFile | null
  readonly sharingAvailable?: boolean
  readonly temporaryFile?: NativeTemporaryTextFile
  readonly activity?: string[]
} = {}) {
  const fallbackWrittenText = { value: "" }
  const fallbackTemporaryFile =
    temporaryFile ??
    createTemporaryFile({
      writtenText: fallbackWrittenText,
      activity,
    })
  return Object.freeze({
    selectJsonFile: vi.fn(async () => selectedFile),
    createTemporaryFile: vi.fn(() => fallbackTemporaryFile),
    isSharingAvailable: vi.fn(async () => sharingAvailable),
    shareFile: vi.fn(async () => {
      activity.push("share")
    }),
  }) satisfies NativePlayerDataFileServices
}

describe("createNativePlayerDataFileAdapter", () => {
  it("treats a canceled native picker as a valid no-selection outcome", async () => {
    const services = createServices()
    const adapter = createNativePlayerDataFileAdapter(services)

    await expect(adapter.selectJsonForImport()).resolves.toBeNull()
  })

  it("reads a bounded selected JSON file without interpreting it", async () => {
    const selectedFile = createReadableFile({
      serialized: '["wayvm-export","🦝"]',
    })
    const services = createServices({ selectedFile })
    const adapter = createNativePlayerDataFileAdapter(services)

    await expect(adapter.selectJsonForImport()).resolves.toBe(
      '["wayvm-export","🦝"]',
    )
    expect(selectedFile.text).toHaveBeenCalledOnce()
  })

  it("rejects an oversized selected file before reading it", async () => {
    const selectedFile = createReadableFile({
      serialized: "unread",
      size: MAX_PERSISTED_JSON_BYTES + 1,
    })
    const services = createServices({ selectedFile })
    const adapter = createNativePlayerDataFileAdapter(services)

    await expect(adapter.selectJsonForImport()).rejects.toThrow(
      "Backup file exceeds the 8 MiB import limit",
    )
    expect(selectedFile.text).not.toHaveBeenCalled()
  })

  it("rejects oversized bytes when native size metadata understates them", async () => {
    const selectedFile = createReadableFile({
      serialized: "x".repeat(MAX_PERSISTED_JSON_BYTES + 1),
      size: 0,
    })
    const services = createServices({ selectedFile })
    const adapter = createNativePlayerDataFileAdapter(services)

    await expect(adapter.selectJsonForImport()).rejects.toThrow(
      "Backup file exceeds the 8 MiB import limit",
    )
    expect(selectedFile.text).toHaveBeenCalledOnce()
  })

  it("writes verifies shares and deletes canonical backup bytes in order", async () => {
    const activity: string[] = []
    const services = createServices({ activity })
    const adapter = createNativePlayerDataFileAdapter(services)

    await adapter.exportJson({
      filename: BACKUP_FILENAME,
      serialized: '["wayvm-export","🦝"]',
    })

    expect(services.createTemporaryFile).toHaveBeenCalledWith(BACKUP_FILENAME)
    expect(services.shareFile).toHaveBeenCalledWith(BACKUP_URI)
    expect(activity).toEqual(["create:true", "write", "read", "share", "delete"])
  })

  it("rejects export before writing when native sharing is unavailable", async () => {
    const services = createServices({ sharingAvailable: false })
    const adapter = createNativePlayerDataFileAdapter(services)

    await expect(
      adapter.exportJson({
        filename: BACKUP_FILENAME,
        serialized: '["wayvm-export"]',
      }),
    ).rejects.toThrow("File sharing is unavailable on this device")
    expect(services.createTemporaryFile).not.toHaveBeenCalled()
    expect(services.shareFile).not.toHaveBeenCalled()
  })

  it("deletes a temporary file after export verification fails", async () => {
    const activity: string[] = []
    const temporaryFile = createTemporaryFile({
      writtenText: { value: "" },
      reportedSize: 0,
      activity,
    })
    const services = createServices({ temporaryFile, activity })
    const adapter = createNativePlayerDataFileAdapter(services)

    await expect(
      adapter.exportJson({
        filename: BACKUP_FILENAME,
        serialized: '["wayvm-export"]',
      }),
    ).rejects.toThrow("Native backup file verification failed")
    expect(activity).toEqual(["create:true", "write", "delete"])
    expect(services.shareFile).not.toHaveBeenCalled()
  })

  it("deletes a temporary file after the native share sheet rejects", async () => {
    const activity: string[] = []
    const services = createServices({ activity })
    const adapter = createNativePlayerDataFileAdapter(services)
    services.shareFile.mockRejectedValueOnce(new Error("Native share failed"))

    await expect(
      adapter.exportJson({
        filename: BACKUP_FILENAME,
        serialized: '["wayvm-export"]',
      }),
    ).rejects.toThrow("Native share failed")
    expect(activity).toEqual(["create:true", "write", "read", "delete"])
  })
})

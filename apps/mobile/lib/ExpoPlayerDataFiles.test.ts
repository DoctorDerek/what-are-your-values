import { afterEach, describe, expect, it, vi } from "vitest"
import { expoPlayerDataFileAdapter } from "./ExpoPlayerDataFiles"

const expoMocks = vi.hoisted(() => ({
  getDocumentAsync: vi.fn(),
  createFile: vi.fn(),
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}))

vi.mock("expo-document-picker", () => ({
  getDocumentAsync: expoMocks.getDocumentAsync,
}))

vi.mock("expo-file-system", () => ({
  File: function MockFile(...pathParts: unknown[]) {
    return expoMocks.createFile(...pathParts)
  },
  Paths: Object.freeze({ cache: "file:///cache" }),
}))

vi.mock("expo-sharing", () => ({
  isAvailableAsync: expoMocks.isAvailableAsync,
  shareAsync: expoMocks.shareAsync,
}))

const BACKUP_FILENAME =
  "what-are-your-values-mapache-backup-2026-08-01-123456Z.json"

function createVerifiedTemporaryFile() {
  let serialized = ""
  return Object.freeze({
    uri: `file:///cache/${BACKUP_FILENAME}`,
    get size() {
      return new TextEncoder().encode(serialized).byteLength
    },
    create: vi.fn(),
    delete: vi.fn(),
    write: vi.fn((content: string) => {
      serialized = content
    }),
    text: vi.fn(async () => serialized),
  })
}

describe("Expo Player Data Files", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("returns no import bytes when the system picker is canceled", async () => {
    expoMocks.getDocumentAsync.mockResolvedValue({
      canceled: true,
      assets: null,
    })

    await expect(
      expoPlayerDataFileAdapter.selectJsonForImport(),
    ).resolves.toBeNull()
    expect(expoMocks.getDocumentAsync).toHaveBeenCalledWith({
      type: "application/json",
      copyToCacheDirectory: true,
      multiple: false,
    })
    expect(expoMocks.createFile).not.toHaveBeenCalled()
  })

  it("reads the one file returned by the system picker", async () => {
    const selectedFile = Object.freeze({
      uri: "file:///cache/import.json",
      size: 18,
      text: vi.fn(async () => '["wayvm-export"]'),
    })
    expoMocks.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: selectedFile.uri }],
    })
    expoMocks.createFile.mockReturnValue(selectedFile)

    await expect(expoPlayerDataFileAdapter.selectJsonForImport()).resolves.toBe(
      '["wayvm-export"]',
    )
    expect(expoMocks.createFile).toHaveBeenCalledWith(selectedFile.uri)
  })

  it("rejects an impossible successful picker result without one file", async () => {
    expoMocks.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [],
    })

    await expect(
      expoPlayerDataFileAdapter.selectJsonForImport(),
    ).rejects.toThrow("The native file picker returned an invalid selection")
  })

  it("writes a verified cache file opens the native share sheet and deletes it", async () => {
    const temporaryFile = createVerifiedTemporaryFile()
    expoMocks.isAvailableAsync.mockResolvedValue(true)
    expoMocks.createFile.mockReturnValue(temporaryFile)
    expoMocks.shareAsync.mockResolvedValue(undefined)

    await expoPlayerDataFileAdapter.exportJson({
      filename: BACKUP_FILENAME,
      serialized: '["wayvm-export","🦝"]',
    })

    expect(expoMocks.createFile).toHaveBeenCalledWith(
      "file:///cache",
      BACKUP_FILENAME,
    )
    expect(expoMocks.shareAsync).toHaveBeenCalledWith(temporaryFile.uri, {
      mimeType: "application/json",
      UTI: "public.json",
      dialogTitle: "Save or share your private WAYVM backup",
    })
    expect(temporaryFile.delete).toHaveBeenCalledOnce()
  })
})

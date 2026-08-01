import { MAX_PERSISTED_JSON_BYTES } from "@game/machines/src/PersistedJson"
import type { PreparedWayvmDownload } from "@game/machines/src/PlayerDataPortabilityActors"

export type NativeReadableTextFile = {
  readonly uri: string
  readonly size: number
  readonly text: () => Promise<string>
}

export type NativeTemporaryTextFile = NativeReadableTextFile & {
  readonly create: (options: { readonly overwrite: boolean }) => void
  readonly delete: () => void
  readonly write: (content: string) => void
}

export type NativePlayerDataFileServices = {
  readonly selectJsonFile: () => Promise<NativeReadableTextFile | null>
  readonly createTemporaryFile: (filename: string) => NativeTemporaryTextFile
  readonly isSharingAvailable: () => Promise<boolean>
  readonly shareFile: (uri: string) => Promise<void>
}

function validateImportByteLength(byteLength: number) {
  if (byteLength > MAX_PERSISTED_JSON_BYTES) {
    throw new Error("Backup file exceeds the 8 MiB import limit")
  }
}

export function createNativePlayerDataFileAdapter(
  services: NativePlayerDataFileServices,
) {
  return Object.freeze({
    selectJsonForImport: async () => {
      const selectedFile = await services.selectJsonFile()
      if (!selectedFile) {
        return null
      }

      validateImportByteLength(selectedFile.size)
      const serialized = await selectedFile.text()
      validateImportByteLength(new TextEncoder().encode(serialized).byteLength)
      return serialized
    },
    exportJson: async ({ filename, serialized }: PreparedWayvmDownload) => {
      if (!(await services.isSharingAvailable())) {
        throw new Error("File sharing is unavailable on this device")
      }

      const temporaryFile = services.createTemporaryFile(filename)
      temporaryFile.create({ overwrite: true })
      try {
        temporaryFile.write(serialized)

        const expectedByteLength = new TextEncoder().encode(serialized).byteLength
        if (
          temporaryFile.size !== expectedByteLength ||
          (await temporaryFile.text()) !== serialized
        ) {
          throw new Error("Native backup file verification failed")
        }

        await services.shareFile(temporaryFile.uri)
      } finally {
        temporaryFile.delete()
      }
    },
  })
}

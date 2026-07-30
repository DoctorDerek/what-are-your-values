import { MAX_PERSISTED_JSON_BYTES } from "@game/machines/src/PersistedJson"
import type { PreparedWayvmDownload } from "@game/machines/src/PlayerDataPortabilityActors"

export const WAYVM_IMPORT_FILE_ACCEPT = ".json,application/json" as const

export function downloadPlayerDataFile({
  filename,
  serialized,
}: PreparedWayvmDownload) {
  const objectUrl = URL.createObjectURL(
    new Blob([serialized], { type: "application/json;charset=utf-8" }),
  )
  const downloadLink = document.createElement("a")
  downloadLink.href = objectUrl
  downloadLink.download = filename
  downloadLink.click()
  URL.revokeObjectURL(objectUrl)
}

export async function readPlayerDataFile(file: File) {
  if (file.size > MAX_PERSISTED_JSON_BYTES) {
    throw new Error("Backup file exceeds the 8 MiB import limit")
  }

  return file.text()
}

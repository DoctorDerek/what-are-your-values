import { MAX_PERSISTED_JSON_BYTES } from "@game/machines/src/PersistedJson"
import type { PreparedWayvmDownload } from "@game/machines/src/PlayerDataPortabilityActors"
import { playerDataPortabilityCopy } from "@game/machines/src/PlayerDataPortabilityCopy"

export const WAYVM_IMPORT_FILE_ACCEPT = ".json,application/json" as const

export function downloadPlayerDataFile({
  filename,
  serialized,
}: PreparedWayvmDownload) {
  const downloadLink = document.createElement("a")
  const objectUrl = URL.createObjectURL(
    new Blob([serialized], { type: "application/json;charset=utf-8" }),
  )

  downloadLink.href = objectUrl
  downloadLink.download = filename
  downloadLink.hidden = true

  try {
    document.body.append(downloadLink)
    downloadLink.click()
  } finally {
    downloadLink.remove()
    URL.revokeObjectURL(objectUrl)
  }
}

export async function readPlayerDataFile(file: File) {
  if (file.size > MAX_PERSISTED_JSON_BYTES)
    throw new Error(playerDataPortabilityCopy.importUnsafe)

  let serialized: string
  try {
    serialized = await file.text()
  } catch {
    throw new Error(playerDataPortabilityCopy.importInvalid)
  }

  if (
    new TextEncoder().encode(serialized).byteLength > MAX_PERSISTED_JSON_BYTES
  )
    throw new Error(playerDataPortabilityCopy.importUnsafe)

  return serialized
}

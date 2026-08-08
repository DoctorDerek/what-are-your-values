import type { PreparedWayvmDownload } from "@game/machines/src/PlayerDataPortabilityActors"
import {
  getWayvmImportValidationIssue,
  playerDataPortabilityCopy,
} from "@game/machines/src/PlayerDataPortabilityCopy"
import { rootMachine } from "@game/machines/src/RootMachine"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ActorRefFrom, SnapshotFrom } from "xstate"
import { expoPlayerDataFileAdapter } from "@/lib/ExpoPlayerDataFiles"

type RootMachineSnapshot = SnapshotFrom<typeof rootMachine>
type RootMachineSend = ActorRefFrom<typeof rootMachine>["send"]

export default function useNativePlayerDataFiles({
  state,
  send,
}: {
  readonly state: RootMachineSnapshot
  readonly send: RootMachineSend
}) {
  const deliveredDownloadsRef = useRef(new Set<PreparedWayvmDownload>())
  const [isReadingImportFile, setIsReadingImportFile] = useState(false)

  useEffect(() => {
    const preparedDownload = state.context.preparedDownload
    if (
      !state.matches("DataManagement") ||
      !preparedDownload ||
      deliveredDownloadsRef.current.has(preparedDownload)
    )
      return

    deliveredDownloadsRef.current.add(preparedDownload)
    void expoPlayerDataFileAdapter
      .exportJson(preparedDownload)
      .then(() => send({ type: "DATA_MANAGEMENT.EXPORT_CONSUMED" }))
      .catch(() =>
        send({
          type: "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED",
          issue: playerDataPortabilityCopy.exportFailure,
        }),
      )
  }, [send, state])

  const chooseBackup = useCallback(async () => {
    send({ type: "DATA_MANAGEMENT.IMPORT_FILE_READ_REQUESTED" })
    setIsReadingImportFile(true)
    try {
      const serialized = await expoPlayerDataFileAdapter.selectJsonForImport()
      if (serialized === null) return

      send({
        type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
        serialized,
      })
    } catch (error: unknown) {
      send({
        type: "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED",
        issue: getWayvmImportValidationIssue(error),
      })
    } finally {
      setIsReadingImportFile(false)
    }
  }, [send])

  return { isReadingImportFile, chooseBackup }
}

import type { PreparedWayvmDownload } from "@game/machines/src/PlayerDataPortabilityActors"
import {
  getWayvmImportValidationIssue,
  playerDataPortabilityCopy,
} from "@game/machines/src/PlayerDataPortabilityCopy"
import { rootMachine } from "@game/machines/src/RootMachine"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ActorRefFrom, SnapshotFrom } from "xstate"
import { expoPlayerDataFileAdapter } from "@/lib/ExpoPlayerDataFiles"
import {
  createNativePlayerDataExportConsumedEvent,
  createNativePlayerDataFileFailureEvent,
  createNativePlayerDataFileReadStartedEvent,
  createNativePlayerDataImportPreparedEvent,
  type NativePlayerDataFileDestination,
} from "@/lib/NativePlayerDataFileEvents"

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
    const isDataManagementDownload = state.matches("DataManagement")
    const isRecoveryDownload = state.matches("PersistenceFailure")
    if (
      (!isDataManagementDownload && !isRecoveryDownload) ||
      !preparedDownload ||
      deliveredDownloadsRef.current.has(preparedDownload)
    )
      return

    const destination: NativePlayerDataFileDestination = isRecoveryDownload
      ? "recovery"
      : "data-management"
    deliveredDownloadsRef.current.add(preparedDownload)
    void expoPlayerDataFileAdapter
      .exportJson(preparedDownload)
      .then(() => send(createNativePlayerDataExportConsumedEvent(destination)))
      .catch(() =>
        send(
          createNativePlayerDataFileFailureEvent(
            destination,
            playerDataPortabilityCopy.exportFailure,
          ),
        ),
      )
  }, [send, state])

  const chooseBackup = useCallback(
    async (destination: NativePlayerDataFileDestination) => {
      const fileReadStartedEvent =
        createNativePlayerDataFileReadStartedEvent(destination)
      if (fileReadStartedEvent) send(fileReadStartedEvent)
      setIsReadingImportFile(true)
      try {
        const serialized = await expoPlayerDataFileAdapter.selectJsonForImport()
        if (serialized === null) return

        send(createNativePlayerDataImportPreparedEvent(destination, serialized))
      } catch (error: unknown) {
        send(
          createNativePlayerDataFileFailureEvent(
            destination,
            getWayvmImportValidationIssue(error),
          ),
        )
      } finally {
        setIsReadingImportFile(false)
      }
    },
    [send],
  )

  return { isReadingImportFile, chooseBackup }
}

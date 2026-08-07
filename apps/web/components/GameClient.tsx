"use client"

import type { CustomValueId, ValueId } from "@game/data/src/Value"
import { rankValues } from "@game/data/src/ValueRanking"
import {
  projectBattlePair,
  type BattleSchedulerRestorePoint,
} from "@game/machines/src/BattleScheduler"
import { playerDataPortabilityCopy } from "@game/machines/src/PlayerDataPortabilityCopy"
import {
  DELETE_ALL_DATA_ACKNOWLEDGMENT,
  type PlayerDataResetKind,
  type PlayerDataResetReview,
} from "@game/machines/src/PlayerDataReset"
import { rootMachine } from "@game/machines/src/RootMachine"
import { getErrorMessage } from "@game/utils/src/Errors"
import { useMachine } from "@xstate/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createIndexedDbDurableStore } from "@/lib/IndexedDbDurableStore"
import {
  downloadPlayerDataFile,
  readPlayerDataFile,
} from "@/lib/PlayerDataFiles"
import packageMetadata from "@/package.json"
import AllValues from "./AllValues"
import Crucible from "./Crucible"
import DataManagement, { type DataManagementActivity } from "./DataManagement"
import Hub from "./Hub"
import Splash from "./Splash"

export default function GameClient() {
  const durableStore = useMemo(() => createIndexedDbDurableStore(), [])
  const [state, send] = useMachine(rootMachine, {
    input: {
      durableStore,
      appVersion: packageMetadata.version,
      sourceBuild:
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "development",
      now: () => new Date().toISOString(),
      randomUuid: () => crypto.randomUUID(),
    },
  })
  const browseAllValuesButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusTargetIdRef = useRef("hub-browse-all-values-button")
  const [pendingAllValuesValueId, setPendingAllValuesValueId] =
    useState<ValueId | null>(null)
  const [shouldOpenCustomValueBuilder, setShouldOpenCustomValueBuilder] =
    useState(false)
  const shouldRestoreHubFocusRef = useRef(false)
  const deliveredDownloadsRef = useRef(new WeakSet<object>())
  const [isReadingImportFile, setIsReadingImportFile] = useState(false)
  const battleProfile = state.context.playerData?.profile ?? null
  const rankedValues = useMemo(
    () =>
      battleProfile
        ? rankValues(battleProfile.activeDeck, battleProfile.progressById)
        : [],
    [battleProfile],
  )
  const presentedBattle = useMemo(
    () =>
      battleProfile
        ? Object.freeze({
            pair: projectBattlePair(
              battleProfile.activeDeck,
              battleProfile.scheduler,
            ),
            scheduler: battleProfile.scheduler,
          })
        : null,
    [battleProfile],
  )
  const handleWinnerSelected = useCallback(
    (winnerId: ValueId, expectedScheduler: BattleSchedulerRestorePoint) => {
      send({
        type: "BATTLE.WINNER_SELECTED",
        winnerId,
        expectedScheduler,
      })
    },
    [send],
  )
  const handleAllValuesClose = useCallback(() => {
    send({ type: "ALL_VALUES.CLOSE_REQUESTED" })
  }, [send])
  const openAllValues = useCallback(
    ({
      focusTargetId,
      valueId,
      openCustomValueBuilder,
    }: {
      focusTargetId: string
      valueId?: ValueId | null
      openCustomValueBuilder?: boolean
    }) => {
      returnFocusTargetIdRef.current = focusTargetId
      setPendingAllValuesValueId(valueId ?? null)
      setShouldOpenCustomValueBuilder(openCustomValueBuilder === true)
      shouldRestoreHubFocusRef.current = true
      send({ type: "ALL_VALUES.OPEN_REQUESTED" })
    },
    [send],
  )
  const handleAddCustomValue = useCallback(
    (name: string, definition: string) => {
      setShouldOpenCustomValueBuilder(false)
      send({
        type: "ALL_VALUES.ADD_REQUESTED",
        name,
        definition,
      })
    },
    [send],
  )
  const handleUpdateCustomValue = useCallback(
    (valueId: CustomValueId, name: string, definition: string) => {
      send({
        type: "ALL_VALUES.UPDATE_REQUESTED",
        valueId,
        name,
        definition,
      })
    },
    [send],
  )
  const openDataManagement = useCallback(
    (focusTargetId: string) => {
      returnFocusTargetIdRef.current = focusTargetId
      shouldRestoreHubFocusRef.current = true
      send({ type: "DATA_MANAGEMENT.OPEN_REQUESTED" })
    },
    [send],
  )
  const handleImportFile = useCallback(
    async (file: File) => {
      send({ type: "DATA_MANAGEMENT.IMPORT_FILE_READ_REQUESTED" })
      setIsReadingImportFile(true)
      try {
        const serialized = await readPlayerDataFile(file)
        send({
          type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
          serialized,
        })
      } catch (error) {
        send({
          type: "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED",
          issue: getErrorMessage(error),
        })
      } finally {
        setIsReadingImportFile(false)
      }
    },
    [send],
  )
  const handleResetRequested = useCallback(
    (resetKind: PlayerDataResetKind) => {
      if (resetKind === "delete-all-custom-values")
        return send({ type: "CUSTOM_VALUE.DELETE_ALL_REQUESTED" })
      if (resetKind === "reset-levels-and-experience")
        return send({ type: "RESET.LEVELS_AND_EXPERIENCE_REQUESTED" })
      if (resetKind === "reset-achievements")
        return send({ type: "RESET.ACHIEVEMENTS_REQUESTED" })

      return send({ type: "DELETE_ALL_DATA.REQUESTED" })
    },
    [send],
  )
  const handleResetConfirmed = useCallback(
    (review: PlayerDataResetReview) => {
      const { confirmationId, resetKind } = review
      if (resetKind === "delete-all-custom-values")
        return send({
          type: "CUSTOM_VALUE.DELETE_ALL_CONFIRMED",
          confirmationId,
        })
      if (resetKind === "reset-levels-and-experience")
        return send({
          type: "RESET.LEVELS_AND_EXPERIENCE_CONFIRMED",
          confirmationId,
        })
      if (resetKind === "reset-achievements")
        return send({
          type: "RESET.ACHIEVEMENTS_CONFIRMED",
          confirmationId,
        })

      return send({
        type: "DELETE_ALL_DATA.CONFIRMED",
        confirmationId,
        phrase: DELETE_ALL_DATA_ACKNOWLEDGMENT,
      })
    },
    [send],
  )

  useEffect(() => {
    send({
      type: "APP.HYDRATED",
      schedulerSeed: crypto.randomUUID(),
    })
  }, [send])

  useEffect(() => {
    if (state.matches("Hub") && shouldRestoreHubFocusRef.current) {
      shouldRestoreHubFocusRef.current = false
      document.getElementById(returnFocusTargetIdRef.current)?.focus()
    }
  }, [state])

  useEffect(() => {
    const preparedDownload = state.context.preparedDownload
    if (
      !state.matches("DataManagement") ||
      !preparedDownload ||
      deliveredDownloadsRef.current.has(preparedDownload)
    )
      return

    deliveredDownloadsRef.current.add(preparedDownload)
    try {
      downloadPlayerDataFile(preparedDownload)
      send({ type: "DATA_MANAGEMENT.EXPORT_CONSUMED" })
    } catch {
      send({
        type: "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED",
        issue: playerDataPortabilityCopy.exportFailure,
      })
    }
  }, [send, state])

  const dataManagementActivity: DataManagementActivity | null =
    isReadingImportFile || state.matches({ DataManagement: "PreparingImport" })
      ? "Checking backup…"
      : state.matches({ DataManagement: "Exporting" })
        ? "Creating backup…"
        : state.matches({ DataManagement: "CreatingPreImportBackup" })
          ? "Creating safety backup…"
          : state.matches({ DataManagement: "ReplacingImport" })
            ? "Restoring backup…"
            : state.matches({ DataManagement: "ExportingResetBackup" })
              ? "Creating backup…"
              : state.matches({ DataManagement: "ApplyingScopedReset" })
                ? "Applying reset…"
                : state.matches({ DataManagement: "DeletingAllData" })
                  ? "Deleting data…"
                  : null

  if (
    state.matches("Hydrating") ||
    state.matches("LoadingProfile") ||
    state.matches("InitializingProfile")
  ) {
    return (
      <div className="noise-bg bg-mapache-vivid-dark text-mapache-vivid-primary-cyan flex h-[100dvh] w-[100dvw] items-center justify-center text-6xl font-black uppercase drop-shadow-[4px_4px_0px_#000000]">
        Booting Machine...
      </div>
    )
  }

  if (state.matches("PersistenceFailure")) {
    return (
      <main className="noise-bg bg-mapache-vivid-dark text-mapache-vivid-primary-cyan flex min-h-[100dvh] w-full flex-col items-center justify-center gap-6 p-8 text-center">
        <h1 className="max-w-4xl text-4xl font-black uppercase drop-shadow-[4px_4px_0px_#000000] sm:text-6xl">
          We couldn’t safely load your values.
        </h1>
        <p className="max-w-2xl text-xl font-bold text-white sm:text-2xl">
          Your saved data was left unchanged. Reload this page to try again.
        </p>
      </main>
    )
  }

  if (state.matches("Splash")) {
    return (
      <Splash
        notice={state.context.portabilityNotice}
        onComplete={() => send({ type: "INTRODUCTION.COMPLETED" })}
      />
    )
  }

  if (!battleProfile || !presentedBattle) {
    throw new Error("Battle profile is unavailable after hydration")
  }

  if (state.matches("Hub")) {
    return (
      <Hub
        rankedValues={rankedValues}
        browseAllValuesButtonRef={browseAllValuesButtonRef}
        dataNotice={state.context.portabilityNotice}
        onBrowseAllValues={(focusTargetId) => openAllValues({ focusTargetId })}
        onAddCustomValue={(focusTargetId) =>
          openAllValues({ focusTargetId, openCustomValueBuilder: true })
        }
        onOpenDataManagement={openDataManagement}
        onOpenValue={(valueId, focusTargetId) =>
          openAllValues({ focusTargetId, valueId })
        }
        onStartBattle={() => send({ type: "BATTLE.START_REQUESTED" })}
      />
    )
  }

  if (state.matches("DataManagement")) {
    return (
      <DataManagement
        activity={dataManagementActivity}
        customValueCount={battleProfile.activeDeck.customValues.length}
        issue={state.context.portabilityIssue}
        notice={state.context.portabilityNotice}
        preview={state.context.pendingImport?.preview ?? null}
        resetReview={state.context.pendingResetReview}
        onCancelImport={() =>
          send({ type: "DATA_MANAGEMENT.IMPORT_CANCEL_REQUESTED" })
        }
        onCancelReset={() =>
          send({ type: "DATA_MANAGEMENT.RESET_CANCEL_REQUESTED" })
        }
        onClose={() => send({ type: "DATA_MANAGEMENT.CLOSE_REQUESTED" })}
        onConfirmImport={() =>
          send({ type: "DATA_MANAGEMENT.IMPORT_CONFIRM_REQUESTED" })
        }
        onConfirmReset={handleResetConfirmed}
        onExport={() => send({ type: "DATA_MANAGEMENT.EXPORT_REQUESTED" })}
        onImportFile={(file) => void handleImportFile(file)}
        onRequestReset={handleResetRequested}
      />
    )
  }

  if (state.matches("AllValues")) {
    return (
      <AllValues
        key={battleProfile.scheduler.deckRevision}
        rankedValues={rankedValues}
        initialValueId={pendingAllValuesValueId}
        openCustomValueBuilder={shouldOpenCustomValueBuilder}
        isPersistencePending={state.matches({ AllValues: "Persisting" })}
        persistenceIssue={state.context.persistenceIssue}
        onClose={handleAllValuesClose}
        onAddCustomValue={handleAddCustomValue}
        onUpdateCustomValue={handleUpdateCustomValue}
        onDeleteCustomValue={(valueId) =>
          send({ type: "ALL_VALUES.DELETE_REQUESTED", valueId })
        }
      />
    )
  }

  if (state.matches("Crucible")) {
    const isBattleReady = state.matches({ Crucible: "Ready" })

    return (
      <Crucible
        activeDeck={battleProfile.activeDeck}
        battle={presentedBattle}
        progressById={battleProfile.progressById}
        canUndo={battleProfile.history.length > 0}
        canRedo={battleProfile.redo.length > 0}
        isPersistencePending={!isBattleReady}
        onExit={() => send({ type: "BATTLE.EXIT_REQUESTED" })}
        onUndo={() => send({ type: "BATTLE.UNDO_REQUESTED" })}
        onRedo={() => send({ type: "BATTLE.REDO_REQUESTED" })}
        onWinnerSelected={handleWinnerSelected}
      />
    )
  }

  return null
}

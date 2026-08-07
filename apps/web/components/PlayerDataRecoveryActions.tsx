"use client"

import { playerDataRecoveryCopy } from "@game/machines/src/PlayerDataRecoveryCopy"
import type { Ref } from "react"
import { Button } from "@/components/ui/button"

type SharedRecoveryActions = {
  readonly isBusy: boolean
  readonly onTryAgain: () => void
}

type UnreadableDataRecoveryActions = SharedRecoveryActions & {
  readonly mode: "unreadable-data"
  readonly deleteAllDataButtonRef: Ref<HTMLButtonElement>
  readonly hasLastKnownGoodSave: boolean
  readonly importBackupButtonRef: Ref<HTMLButtonElement>
  readonly restoreLastKnownGoodSaveButtonRef: Ref<HTMLButtonElement>
  readonly onDeleteAllData: () => void
  readonly onExportUnreadableData: () => void
  readonly onImportBackup: () => void
  readonly onRestoreLastKnownGoodSave: () => void
}

type StorageUnavailableRecoveryActions = SharedRecoveryActions & {
  readonly mode: "storage-unavailable"
  readonly canExportCurrentData: boolean
  readonly canReturnWithoutNewChanges: boolean
  readonly onExportCurrentData: () => void
  readonly onReturnWithoutNewChanges: () => void
}

type PlayerDataRecoveryActionsProps =
  UnreadableDataRecoveryActions | StorageUnavailableRecoveryActions

export default function PlayerDataRecoveryActions(
  props: PlayerDataRecoveryActionsProps,
) {
  const { actions } = playerDataRecoveryCopy

  if (props.mode === "unreadable-data") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {props.hasLastKnownGoodSave ? (
          <Button
            ref={props.restoreLastKnownGoodSaveButtonRef}
            type="button"
            size="lg"
            disabled={props.isBusy}
            onClick={props.onRestoreLastKnownGoodSave}
            className="w-full whitespace-normal"
          >
            {actions.restoreLastKnownGoodSave}
          </Button>
        ) : null}
        <Button
          ref={props.importBackupButtonRef}
          type="button"
          variant="secondary"
          size="lg"
          disabled={props.isBusy}
          onClick={props.onImportBackup}
          className="w-full whitespace-normal"
        >
          {actions.importBackup}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={props.isBusy}
          onClick={props.onExportUnreadableData}
          className="w-full whitespace-normal"
        >
          {actions.exportUnreadableData}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={props.isBusy}
          onClick={props.onTryAgain}
          className="w-full whitespace-normal"
        >
          {actions.tryAgain}
        </Button>
        <Button
          ref={props.deleteAllDataButtonRef}
          type="button"
          variant="destructive"
          size="lg"
          disabled={props.isBusy}
          onClick={props.onDeleteAllData}
          className="w-full whitespace-normal sm:col-span-2"
        >
          {actions.deleteAllData}
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {props.canExportCurrentData ? (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={props.isBusy}
          onClick={props.onExportCurrentData}
          className="w-full whitespace-normal"
        >
          {actions.exportCurrentData}
        </Button>
      ) : null}
      <Button
        type="button"
        size="lg"
        disabled={props.isBusy}
        onClick={props.onTryAgain}
        className="w-full whitespace-normal"
      >
        {actions.tryAgain}
      </Button>
      {props.canReturnWithoutNewChanges ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={props.isBusy}
          onClick={props.onReturnWithoutNewChanges}
          className="w-full whitespace-normal sm:col-span-2"
        >
          {actions.returnWithoutNewChanges}
        </Button>
      ) : null}
    </div>
  )
}

"use client"

import { playerDataRecoveryCopy } from "@game/machines/src/PlayerDataRecoveryCopy"
import type { PlayerDataResetReview as PlayerDataResetReviewState } from "@game/machines/src/PlayerDataReset"
import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { useEffect, useRef } from "react"
import MapacheScreen from "@/components/MapacheScreen"
import { WAYVM_IMPORT_FILE_ACCEPT } from "@/lib/PlayerDataFiles"
import PlayerDataImportPreview from "./PlayerDataImportPreview"
import PlayerDataRecoveryActions, {
  playerDataRecoveryActionIds,
} from "./PlayerDataRecoveryActions"
import PlayerDataResetReview from "./PlayerDataResetReview"

export type PlayerDataRecoveryActivity =
  | "Checking backup…"
  | "Creating backup…"
  | "Creating diagnostic file…"
  | "Deleting data…"
  | "Restoring backup…"

type SharedPlayerDataRecoveryProps = {
  readonly activity: PlayerDataRecoveryActivity | null
  readonly issue: string | null
  readonly notice: string | null
  readonly onTryAgain: () => void
}

type UnreadableDataRecoveryProps = SharedPlayerDataRecoveryProps & {
  readonly mode: "unreadable-data"
  readonly hasLastKnownGoodSave: boolean
  readonly pendingImportSource: "last-known-good" | "selected-backup" | null
  readonly preview: WayvmImportPreview | null
  readonly resetReview: PlayerDataResetReviewState | null
  readonly onCancelImport: () => void
  readonly onCancelReset: () => void
  readonly onConfirmImport: () => void
  readonly onConfirmReset: (review: PlayerDataResetReviewState) => void
  readonly onDeleteAllData: () => void
  readonly onExportUnreadableData: () => void
  readonly onImportFile: (file: File) => void
  readonly onRestoreLastKnownGoodSave: () => void
}

type StorageUnavailableRecoveryProps = SharedPlayerDataRecoveryProps & {
  readonly mode: "storage-unavailable"
  readonly canExportCurrentData: boolean
  readonly canReturnWithoutNewChanges: boolean
  readonly onExportCurrentData: () => void
  readonly onReturnWithoutNewChanges: () => void
}

type PlayerDataRecoveryProps =
  UnreadableDataRecoveryProps | StorageUnavailableRecoveryProps

export default function PlayerDataRecovery(props: PlayerDataRecoveryProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const issueRef = useRef<HTMLParagraphElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const previewFocusTargetIdRef = useRef<string | null>(null)
  const shouldRestorePreviewFocusRef = useRef(false)
  const shouldRestoreDeleteFocusRef = useRef(false)
  const currentPreview = props.mode === "unreadable-data" ? props.preview : null
  const currentResetReview =
    props.mode === "unreadable-data" ? props.resetReview : null
  const previousPreviewRef = useRef(currentPreview)
  const previousResetReviewRef = useRef(currentResetReview)
  const isBusy = props.activity !== null
  const copy =
    props.mode === "unreadable-data"
      ? playerDataRecoveryCopy.unreadableData
      : playerDataRecoveryCopy.storageUnavailable

  useEffect(() => {
    headingRef.current?.focus()
  }, [props.mode])

  useEffect(() => {
    issueRef.current?.focus()
  }, [props.issue])

  useEffect(() => {
    if (
      previousPreviewRef.current &&
      !currentPreview &&
      shouldRestorePreviewFocusRef.current
    ) {
      shouldRestorePreviewFocusRef.current = false
      if (previewFocusTargetIdRef.current)
        document.getElementById(previewFocusTargetIdRef.current)?.focus()
    }

    previousPreviewRef.current = currentPreview
  }, [currentPreview])

  useEffect(() => {
    if (
      previousResetReviewRef.current &&
      !currentResetReview &&
      shouldRestoreDeleteFocusRef.current
    ) {
      shouldRestoreDeleteFocusRef.current = false
      document
        .getElementById(playerDataRecoveryActionIds.deleteAllData)
        ?.focus()
    }

    previousResetReviewRef.current = currentResetReview
  }, [currentResetReview])

  return (
    <MapacheScreen
      spacing="standard"
      viewport="scrollable"
      className="flex flex-col items-center"
    >
      <div aria-busy={isBusy} className="flex w-full max-w-5xl flex-col gap-5">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-mapache-vivid-primary-cyan text-4xl font-black uppercase drop-shadow-[5px_5px_0px_#000000] outline-none sm:text-6xl"
        >
          {copy.title}
        </h1>

        <div className="flex flex-col gap-3 text-lg font-bold text-white sm:text-xl">
          {(Array.isArray(copy.body) ? copy.body : [copy.body]).map(
            (paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ),
          )}
        </div>

        {props.mode === "unreadable-data" &&
        !props.hasLastKnownGoodSave &&
        !props.preview &&
        !props.resetReview ? (
          <p className="bg-mapache-vivid-secondary-gold text-mapache-vivid-black border-4 border-black p-4 text-lg font-black shadow-[6px_6px_0px_0px_#000000] sm:text-xl">
            {playerDataRecoveryCopy.unreadableData.noKnownGoodSave}
          </p>
        ) : null}

        {props.activity ? (
          <p
            role="status"
            className="bg-mapache-vivid-primary-cyan text-mapache-vivid-dark border-4 border-black p-4 text-xl font-black uppercase shadow-[6px_6px_0px_0px_#000000]"
          >
            {props.activity}
          </p>
        ) : null}
        {props.notice ? (
          <p
            role="status"
            className="bg-mapache-vivid-secondary-green text-mapache-vivid-dark border-4 border-black p-4 text-xl font-black shadow-[6px_6px_0px_0px_#000000]"
          >
            {props.notice}
          </p>
        ) : null}
        {props.issue ? (
          <p
            ref={issueRef}
            role="alert"
            tabIndex={-1}
            className="bg-mapache-vivid-primary-orange border-4 border-black p-4 text-xl font-black text-white shadow-[6px_6px_0px_0px_#000000] outline-none"
          >
            {props.issue}
          </p>
        ) : null}

        {props.mode === "unreadable-data" ? (
          <>
            <input
              ref={importInputRef}
              type="file"
              accept={WAYVM_IMPORT_FILE_ACCEPT}
              disabled={isBusy}
              aria-label="Choose WAYVM JSON backup for recovery"
              className="sr-only"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ""
                if (file) props.onImportFile(file)
              }}
            />

            {props.resetReview ? (
              <PlayerDataResetReview
                key={props.resetReview.confirmationId}
                isBusy={isBusy}
                review={props.resetReview}
                onCancel={() => {
                  shouldRestoreDeleteFocusRef.current = true
                  props.onCancelReset()
                }}
                onConfirm={props.onConfirmReset}
                onExport={props.onExportUnreadableData}
              />
            ) : props.preview ? (
              <PlayerDataImportPreview
                confirmLabel={
                  props.pendingImportSource === "last-known-good"
                    ? playerDataRecoveryCopy.unreadableData.restoreReviewAction
                    : playerDataRecoveryCopy.unreadableData
                        .selectedBackupReviewAction
                }
                isBusy={isBusy}
                preview={props.preview}
                title={
                  props.pendingImportSource === "last-known-good"
                    ? playerDataRecoveryCopy.unreadableData.restoreReviewTitle
                    : playerDataRecoveryCopy.unreadableData
                        .selectedBackupReviewTitle
                }
                warning={
                  props.pendingImportSource === "last-known-good"
                    ? playerDataRecoveryCopy.unreadableData.restoreConfirmation
                    : playerDataRecoveryCopy.unreadableData
                        .selectedBackupConfirmation
                }
                onCancel={() => {
                  shouldRestorePreviewFocusRef.current = true
                  props.onCancelImport()
                }}
                onConfirm={props.onConfirmImport}
              />
            ) : (
              <PlayerDataRecoveryActions
                mode="unreadable-data"
                hasLastKnownGoodSave={props.hasLastKnownGoodSave}
                isBusy={isBusy}
                onDeleteAllData={() => {
                  shouldRestoreDeleteFocusRef.current = false
                  props.onDeleteAllData()
                }}
                onExportUnreadableData={props.onExportUnreadableData}
                onImportBackup={() => {
                  previewFocusTargetIdRef.current =
                    playerDataRecoveryActionIds.importBackup
                  importInputRef.current?.click()
                }}
                onRestoreLastKnownGoodSave={() => {
                  previewFocusTargetIdRef.current =
                    playerDataRecoveryActionIds.restoreLastKnownGoodSave
                  props.onRestoreLastKnownGoodSave()
                }}
                onTryAgain={props.onTryAgain}
              />
            )}
          </>
        ) : (
          <PlayerDataRecoveryActions
            mode="storage-unavailable"
            canExportCurrentData={props.canExportCurrentData}
            canReturnWithoutNewChanges={props.canReturnWithoutNewChanges}
            isBusy={isBusy}
            onExportCurrentData={props.onExportCurrentData}
            onReturnWithoutNewChanges={props.onReturnWithoutNewChanges}
            onTryAgain={props.onTryAgain}
          />
        )}
      </div>
    </MapacheScreen>
  )
}

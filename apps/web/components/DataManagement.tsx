"use client"

import { playerDataPortabilityCopy } from "@game/machines/src/PlayerDataPortabilityCopy"
import type {
  PlayerDataResetKind,
  PlayerDataResetReview as PlayerDataResetReviewState,
} from "@game/machines/src/PlayerDataReset"
import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { WAYVM_IMPORT_FILE_ACCEPT } from "@/lib/PlayerDataFiles"
import PlayerDataImportPreview from "./PlayerDataImportPreview"
import PlayerDataResetActions from "./PlayerDataResetActions"
import PlayerDataResetReview from "./PlayerDataResetReview"

export type DataManagementActivity =
  | "Creating backup…"
  | "Checking backup…"
  | "Creating safety backup…"
  | "Restoring backup…"
  | "Applying reset…"
  | "Deleting data…"

export default function DataManagement({
  activity,
  customValueCount,
  issue,
  notice,
  preview,
  resetReview,
  onCancelImport,
  onCancelReset,
  onClose,
  onConfirmImport,
  onConfirmReset,
  onExport,
  onImportFile,
  onRequestReset,
}: {
  activity: DataManagementActivity | null
  customValueCount: number
  issue: string | null
  notice: string | null
  preview: WayvmImportPreview | null
  resetReview: PlayerDataResetReviewState | null
  onCancelImport: () => void
  onCancelReset: () => void
  onClose: () => void
  onConfirmImport: () => void
  onConfirmReset: (review: PlayerDataResetReviewState) => void
  onExport: () => void
  onImportFile: (file: File) => void
  onRequestReset: (resetKind: PlayerDataResetKind) => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const issueRef = useRef<HTMLParagraphElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const chooseBackupButtonRef = useRef<HTMLButtonElement>(null)
  const shouldRestoreChooseBackupFocusRef = useRef(false)
  const resetActionFocusTargetIdRef = useRef<string | null>(null)
  const previousResetReviewRef = useRef(resetReview)
  const isBusy = activity !== null

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    issueRef.current?.focus()
  }, [issue])

  useEffect(() => {
    if (preview || !shouldRestoreChooseBackupFocusRef.current) return

    shouldRestoreChooseBackupFocusRef.current = false
    chooseBackupButtonRef.current?.focus()
  }, [preview])

  useEffect(() => {
    if (
      previousResetReviewRef.current &&
      !resetReview &&
      resetActionFocusTargetIdRef.current
    ) {
      document.getElementById(resetActionFocusTargetIdRef.current)?.focus()
    }

    previousResetReviewRef.current = resetReview
  }, [resetReview])

  const handleCancelImport = () => {
    shouldRestoreChooseBackupFocusRef.current = true
    onCancelImport()
  }

  const handleRequestReset = (
    resetKind: PlayerDataResetKind,
    focusTargetId: string,
  ) => {
    resetActionFocusTargetIdRef.current = focusTargetId
    onRequestReset(resetKind)
  }

  return (
    <main className="noise-bg bg-mapache-vivid-dark flex min-h-[100dvh] w-full flex-col items-center p-4 sm:p-8">
      <div className="flex w-full max-w-5xl flex-wrap items-center justify-between gap-4">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-mapache-vivid-primary-cyan text-4xl font-black uppercase drop-shadow-[5px_5px_0px_#000000] outline-none sm:text-6xl"
        >
          {playerDataPortabilityCopy.screenTitle}
        </h1>
        <Button
          type="button"
          variant="outline"
          disabled={isBusy}
          onClick={onClose}
        >
          Back to Your Values
        </Button>
      </div>

      <div
        aria-busy={isBusy}
        className="mt-8 flex w-full max-w-5xl flex-col gap-5"
      >
        <p className="text-lg font-bold text-white sm:text-xl">
          {playerDataPortabilityCopy.introduction}
        </p>

        {activity ? (
          <p
            role="status"
            className="bg-mapache-vivid-primary-cyan text-mapache-vivid-dark border-4 border-black p-4 text-xl font-black uppercase shadow-[6px_6px_0px_0px_#000000]"
          >
            {activity}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="bg-mapache-vivid-secondary-green text-mapache-vivid-dark border-4 border-black p-4 text-xl font-black shadow-[6px_6px_0px_0px_#000000]"
          >
            {notice}
          </p>
        ) : null}
        {issue ? (
          <p
            ref={issueRef}
            role="alert"
            tabIndex={-1}
            className="bg-mapache-vivid-primary-orange border-4 border-black p-4 text-xl font-black text-white shadow-[6px_6px_0px_0px_#000000] outline-none"
          >
            {issue}
          </p>
        ) : null}

        {resetReview ? (
          <PlayerDataResetReview
            key={resetReview.confirmationId}
            isBusy={isBusy}
            review={resetReview}
            onCancel={onCancelReset}
            onConfirm={onConfirmReset}
            onExport={onExport}
          />
        ) : preview ? (
          <PlayerDataImportPreview
            isBusy={isBusy}
            preview={preview}
            onCancel={handleCancelImport}
            onConfirm={onConfirmImport}
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <section
                aria-labelledby="export-data-heading"
                className="flex flex-col border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] sm:p-8"
              >
                <h2
                  id="export-data-heading"
                  className="text-mapache-vivid-dark border-b-4 border-black pb-4 text-3xl font-black uppercase sm:text-4xl"
                >
                  {playerDataPortabilityCopy.exportTitle}
                </h2>
                <p className="text-mapache-vivid-dark flex-1 py-5 text-lg font-bold sm:text-xl">
                  {playerDataPortabilityCopy.exportDescription}
                </p>
                <Button
                  type="button"
                  size="lg"
                  disabled={isBusy}
                  onClick={onExport}
                  className="w-full"
                >
                  {playerDataPortabilityCopy.exportAction}
                </Button>
              </section>

              <section
                aria-labelledby="import-data-heading"
                className="flex flex-col border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] sm:p-8"
              >
                <h2
                  id="import-data-heading"
                  className="text-mapache-vivid-dark border-b-4 border-black pb-4 text-3xl font-black uppercase sm:text-4xl"
                >
                  {playerDataPortabilityCopy.importTitle}
                </h2>
                <p className="text-mapache-vivid-dark flex-1 py-5 text-lg font-bold sm:text-xl">
                  {playerDataPortabilityCopy.importDescription}
                </p>
                <input
                  ref={importInputRef}
                  type="file"
                  accept={WAYVM_IMPORT_FILE_ACCEPT}
                  disabled={isBusy}
                  aria-label="Choose WAYVM JSON backup"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    event.currentTarget.value = ""
                    if (file) onImportFile(file)
                  }}
                />
                <Button
                  ref={chooseBackupButtonRef}
                  type="button"
                  variant="secondary"
                  size="lg"
                  disabled={isBusy}
                  onClick={() => importInputRef.current?.click()}
                  className="w-full"
                >
                  {playerDataPortabilityCopy.chooseBackupAction}
                </Button>
              </section>
            </div>
            <PlayerDataResetActions
              customValueCount={customValueCount}
              isBusy={isBusy}
              onRequestReset={handleRequestReset}
            />
          </>
        )}
      </div>
    </main>
  )
}

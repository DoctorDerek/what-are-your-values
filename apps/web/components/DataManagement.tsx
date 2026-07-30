"use client"

import type { PlayerDataResetKind } from "@game/machines/src/PlayerDataReset"
import { playerDataResetCopy } from "@game/machines/src/PlayerDataResetCopy"
import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { useState } from "react"
import { WAYVM_IMPORT_FILE_ACCEPT } from "@/lib/PlayerDataFiles"
import PlayerDataImportPreview from "./PlayerDataImportPreview"

export type DataManagementActivity =
  | "Checking backup…"
  | "Creating recovery backup…"
  | "Exporting backup…"
  | "Applying reset…"
  | "Deleting local data…"
  | "Replacing local data…"

function ResetReview({
  activity,
  resetKind,
  onCancelReset,
  onConfirmReset,
  onExport,
}: {
  activity: DataManagementActivity | null
  resetKind: PlayerDataResetKind
  onCancelReset: () => void
  onConfirmReset: (deleteAllDataAcknowledged: boolean) => void
  onExport: () => void
}) {
  const [deleteAllDataAcknowledged, setDeleteAllDataAcknowledged] =
    useState(false)
  const copy = playerDataResetCopy[resetKind]
  const requiresAcknowledgment = resetKind === "delete-all-data"

  return (
    <section
      aria-labelledby="reset-review-heading"
      className="border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] sm:p-8"
    >
      <h2
        id="reset-review-heading"
        className="text-mapache-vivid-dark border-b-4 border-black pb-4 text-3xl font-black uppercase sm:text-4xl"
      >
        {copy.title}
      </h2>
      <div className="text-mapache-vivid-dark flex flex-col gap-4 py-5 text-lg font-bold sm:text-xl">
        {copy.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      {requiresAcknowledgment ? (
        <label className="bg-mapache-vivid-primary-yellow text-mapache-vivid-dark flex cursor-pointer items-start gap-4 border-4 border-black p-4 text-lg font-black">
          <input
            type="checkbox"
            checked={deleteAllDataAcknowledged}
            disabled={activity !== null}
            onChange={(event) =>
              setDeleteAllDataAcknowledged(event.currentTarget.checked)
            }
            className="mt-1 h-6 w-6 shrink-0 accent-black"
          />
          I understand that this cannot be undone.
        </label>
      ) : null}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          disabled={activity !== null}
          onClick={onExport}
          className="bg-mapache-vivid-secondary-purple min-h-14 cursor-pointer border-4 border-black px-5 py-4 text-xl font-black text-white uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-wait disabled:opacity-60"
        >
          Export Data
        </button>
        <button
          type="button"
          disabled={activity !== null}
          onClick={onCancelReset}
          className="bg-mapache-vivid-primary-cyan text-mapache-vivid-dark min-h-14 cursor-pointer border-4 border-black px-5 py-4 text-xl font-black uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-wait disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={
            activity !== null ||
            (requiresAcknowledgment && !deleteAllDataAcknowledged)
          }
          onClick={() => onConfirmReset(deleteAllDataAcknowledged)}
          className="bg-mapache-vivid-primary-orange min-h-14 cursor-pointer border-4 border-black px-5 py-4 text-xl font-black text-white uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {copy.action}
        </button>
      </div>
    </section>
  )
}

export default function DataManagement({
  activity,
  canDeleteCustomValues,
  issue,
  notice,
  preview,
  resetKind,
  onCancelImport,
  onCancelReset,
  onClose,
  onConfirmImport,
  onConfirmReset,
  onExport,
  onImportFile,
  onOpenReset,
}: {
  activity: DataManagementActivity | null
  canDeleteCustomValues: boolean
  issue: string | null
  notice: string | null
  preview: WayvmImportPreview | null
  resetKind: PlayerDataResetKind | null
  onCancelImport: () => void
  onCancelReset: () => void
  onClose: () => void
  onConfirmImport: () => void
  onConfirmReset: (deleteAllDataAcknowledged: boolean) => void
  onExport: () => void
  onImportFile: (file: File) => void
  onOpenReset: (resetKind: PlayerDataResetKind) => void
}) {
  return (
    <main className="noise-bg bg-mapache-vivid-dark flex min-h-[100dvh] w-full flex-col items-center p-4 sm:p-8">
      <div className="flex w-full max-w-5xl flex-wrap items-center justify-between gap-4">
        <h1 className="text-mapache-vivid-primary-cyan text-4xl font-black uppercase drop-shadow-[5px_5px_0px_#000000] sm:text-6xl">
          Manage Your Data
        </h1>
        <button
          type="button"
          disabled={activity !== null}
          onClick={onClose}
          className="bg-mapache-vivid-primary-cyan text-mapache-vivid-dark min-h-12 cursor-pointer border-4 border-black px-5 py-3 text-lg font-black uppercase shadow-[6px_6px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
        >
          Back to Your Values
        </button>
      </div>

      <div
        aria-busy={activity !== null}
        className="mt-8 flex w-full max-w-5xl flex-col gap-5"
      >
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
            role="alert"
            className="bg-mapache-vivid-primary-orange border-4 border-black p-4 text-xl font-black text-white shadow-[6px_6px_0px_0px_#000000]"
          >
            {issue}
          </p>
        ) : null}

        {preview ? (
          <PlayerDataImportPreview
            confirmLabel="Replace Current Data"
            isBusy={activity !== null}
            preview={preview}
            replacementWarning="Replacing local data changes your values, rankings, battle history, achievements, and settings. A recovery backup is created first."
            onCancelImport={onCancelImport}
            onConfirmImport={onConfirmImport}
          />
        ) : resetKind ? (
          <ResetReview
            key={resetKind}
            activity={activity}
            resetKind={resetKind}
            onCancelReset={onCancelReset}
            onConfirmReset={onConfirmReset}
            onExport={onExport}
          />
        ) : (
          <>
            <section
              aria-labelledby="private-backups-heading"
              className="border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] sm:p-8"
            >
              <h2
                id="private-backups-heading"
                className="text-mapache-vivid-dark border-b-4 border-black pb-4 text-3xl font-black uppercase sm:text-4xl"
              >
                Private Backups
              </h2>
              <p className="text-mapache-vivid-dark py-5 text-lg font-bold sm:text-xl">
                Export one complete backup of your values, progress,
                achievements, and settings. Importing stays local to this
                device.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <button
                  type="button"
                  disabled={activity !== null}
                  onClick={onExport}
                  className="bg-mapache-vivid-secondary-purple min-h-14 flex-1 cursor-pointer border-4 border-black px-5 py-4 text-xl font-black text-white uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-wait disabled:opacity-60"
                >
                  Export Data
                </button>
                <label className="bg-mapache-vivid-primary-cyan text-mapache-vivid-dark flex min-h-14 flex-1 cursor-pointer items-center justify-center border-4 border-black px-5 py-4 text-center text-xl font-black uppercase shadow-[6px_6px_0px_0px_#000000] focus-within:outline-4 focus-within:outline-offset-4 focus-within:outline-white hover:-translate-y-1 active:translate-x-[6px] active:translate-y-[6px] active:shadow-none has-disabled:cursor-wait has-disabled:opacity-60">
                  Import Data
                  <input
                    type="file"
                    accept={WAYVM_IMPORT_FILE_ACCEPT}
                    disabled={activity !== null}
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0]
                      event.currentTarget.value = ""
                      if (file) {
                        onImportFile(file)
                      }
                    }}
                  />
                </label>
              </div>
            </section>
            <section
              aria-labelledby="reset-actions-heading"
              className="border-mapache-vivid-primary-orange border-4 bg-black p-5 shadow-[8px_8px_0px_0px_#ff5a1f] sm:p-8"
            >
              <h2
                id="reset-actions-heading"
                className="text-mapache-vivid-primary-orange border-mapache-vivid-primary-orange border-b-4 pb-4 text-3xl font-black uppercase sm:text-4xl"
              >
                Reset or Delete
              </h2>
              <p className="py-5 text-lg font-bold text-white sm:text-xl">
                Each action changes a different part of your local data. Review
                the exact scope before confirming.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(
                  Object.keys(
                    playerDataResetCopy,
                  ) as readonly PlayerDataResetKind[]
                ).map((candidateResetKind) => {
                  const isUnavailableCustomValueDelete =
                    candidateResetKind === "delete-all-custom-values" &&
                    !canDeleteCustomValues

                  return (
                    <button
                      key={candidateResetKind}
                      type="button"
                      disabled={
                        activity !== null || isUnavailableCustomValueDelete
                      }
                      onClick={() => onOpenReset(candidateResetKind)}
                      className="bg-mapache-vivid-primary-orange min-h-14 cursor-pointer border-4 border-white px-5 py-4 text-lg font-black text-white uppercase shadow-[5px_5px_0px_0px_#ffffff] hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[5px] active:translate-y-[5px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {playerDataResetCopy[candidateResetKind].action}
                    </button>
                  )
                })}
              </div>
              {!canDeleteCustomValues ? (
                <p className="mt-4 font-bold text-white">
                  There are no Custom Values to delete.
                </p>
              ) : null}
            </section>
          </>
        )}
      </div>
    </main>
  )
}

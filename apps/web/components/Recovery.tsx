"use client"

import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { useState } from "react"
import { WAYVM_IMPORT_FILE_ACCEPT } from "@/lib/PlayerDataFiles"
import PlayerDataImportPreview from "./PlayerDataImportPreview"

export type RecoveryActivity =
  | "Checking backup…"
  | "Deleting local data…"
  | "Exporting unreadable data…"
  | "Replacing unreadable data…"

export type RecoveryImportSource = "last-known-good" | "selected-backup" | null

export default function Recovery({
  activity,
  hasCapturedData,
  hasLastKnownGoodSave,
  importSource,
  issue,
  notice,
  preview,
  onCancelImport,
  onConfirmImport,
  onDeleteAllData,
  onExportUnreadableData,
  onImportFile,
  onRestoreLastKnownGoodSave,
}: {
  activity: RecoveryActivity | null
  hasCapturedData: boolean
  hasLastKnownGoodSave: boolean
  importSource: RecoveryImportSource
  issue: string | null
  notice: string | null
  preview: WayvmImportPreview | null
  onCancelImport: () => void
  onConfirmImport: () => void
  onDeleteAllData: (acknowledged: boolean) => void
  onExportUnreadableData: () => void
  onImportFile: (file: File) => void
  onRestoreLastKnownGoodSave: () => void
}) {
  const [deleteAllDataAcknowledged, setDeleteAllDataAcknowledged] =
    useState(false)

  if (!hasCapturedData) {
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

  return (
    <main className="noise-bg bg-mapache-vivid-dark flex min-h-[100dvh] w-full flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-5xl">
        <h1 className="text-mapache-vivid-primary-cyan text-4xl font-black uppercase drop-shadow-[5px_5px_0px_#000000] sm:text-6xl">
          Your Saved Data Needs Attention
        </h1>
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
            confirmLabel={
              importSource === "last-known-good"
                ? "Restore Last Known-Good Save"
                : "Import Backup"
            }
            isBusy={activity !== null}
            preview={preview}
            replacementWarning={
              importSource === "last-known-good"
                ? "Restore the last known-good save? The unreadable current save will be preserved until restoration succeeds."
                : "Import this backup? The unreadable current save will be preserved until replacement succeeds."
            }
            onCancelImport={onCancelImport}
            onConfirmImport={onConfirmImport}
          />
        ) : (
          <>
            <section className="border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] sm:p-8">
              <div className="text-mapache-vivid-dark flex flex-col gap-4 text-lg font-bold sm:text-xl">
                <p>
                  WAYVM could not safely load the current save on this device.
                  Nothing has been erased.
                </p>
                <p>
                  You can restore the last known-good save, import another
                  backup, download the unreadable data for recovery, or choose
                  Delete All Data.
                </p>
                {!hasLastKnownGoodSave ? (
                  <p className="bg-mapache-vivid-primary-yellow border-4 border-black p-4 font-black">
                    No last known-good save is available. You can import a
                    backup, export the unreadable data, or choose Delete All
                    Data.
                  </p>
                ) : null}
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {hasLastKnownGoodSave ? (
                  <button
                    type="button"
                    disabled={activity !== null}
                    onClick={onRestoreLastKnownGoodSave}
                    className="bg-mapache-vivid-secondary-green text-mapache-vivid-dark min-h-14 cursor-pointer border-4 border-black px-5 py-4 text-lg font-black uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-wait disabled:opacity-60"
                  >
                    Restore Last Known-Good Save
                  </button>
                ) : null}
                <label className="bg-mapache-vivid-primary-cyan text-mapache-vivid-dark flex min-h-14 cursor-pointer items-center justify-center border-4 border-black px-5 py-4 text-center text-lg font-black uppercase shadow-[6px_6px_0px_0px_#000000] focus-within:outline-4 focus-within:outline-offset-4 focus-within:outline-white hover:-translate-y-1 active:translate-x-[6px] active:translate-y-[6px] active:shadow-none has-disabled:cursor-wait has-disabled:opacity-60">
                  Import Backup
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
                <button
                  type="button"
                  disabled={activity !== null}
                  onClick={onExportUnreadableData}
                  className="bg-mapache-vivid-secondary-purple min-h-14 cursor-pointer border-4 border-black px-5 py-4 text-lg font-black text-white uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-wait disabled:opacity-60"
                >
                  Export Unreadable Data
                </button>
              </div>
              <p className="text-mapache-vivid-dark mt-5 font-bold">
                Exported unreadable data is a diagnostic recovery file, not an
                importable player backup.
              </p>
            </section>

            <section className="border-mapache-vivid-primary-orange border-4 bg-black p-5 shadow-[8px_8px_0px_0px_#ff5a1f] sm:p-8">
              <h2 className="text-mapache-vivid-primary-orange border-mapache-vivid-primary-orange border-b-4 pb-4 text-3xl font-black uppercase sm:text-4xl">
                Delete All Data
              </h2>
              <p className="py-5 text-lg font-bold text-white sm:text-xl">
                This permanently removes every WAYVM player-data record from
                this device and returns to Introduction. Export the unreadable
                data first if you may need it for recovery.
              </p>
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
              <button
                type="button"
                disabled={activity !== null || !deleteAllDataAcknowledged}
                onClick={() => onDeleteAllData(deleteAllDataAcknowledged)}
                className="bg-mapache-vivid-primary-orange mt-5 min-h-14 w-full cursor-pointer border-4 border-white px-5 py-4 text-xl font-black text-white uppercase shadow-[6px_6px_0px_0px_#ffffff] hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete All Data
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

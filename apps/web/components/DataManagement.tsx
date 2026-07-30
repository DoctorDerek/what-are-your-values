"use client"

import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { WAYVM_IMPORT_FILE_ACCEPT } from "@/lib/PlayerDataFiles"

export type DataManagementActivity =
  | "Checking backup…"
  | "Creating recovery backup…"
  | "Exporting backup…"
  | "Replacing local data…"

function formatUtcTimestamp(timestamp: string) {
  return `${new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp))} UTC`
}

function ImportPreview({
  activity,
  preview,
  onCancelImport,
  onConfirmImport,
}: {
  activity: DataManagementActivity | null
  preview: WayvmImportPreview
  onCancelImport: () => void
  onConfirmImport: () => void
}) {
  return (
    <section
      aria-labelledby="import-preview-heading"
      className="border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] sm:p-8"
    >
      <h2
        id="import-preview-heading"
        className="text-mapache-vivid-dark border-b-4 border-black pb-4 text-3xl font-black uppercase sm:text-4xl"
      >
        Review Import
      </h2>
      <p className="text-mapache-vivid-dark py-5 text-lg font-bold sm:text-xl">
        This backup has passed its integrity and compatibility checks.
      </p>
      <dl className="text-mapache-vivid-dark grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="font-black uppercase">Exported</dt>
          <dd>
            <time dateTime={preview.exportedAt}>
              {formatUtcTimestamp(preview.exportedAt)}
            </time>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-black uppercase">Source</dt>
          <dd className="[overflow-wrap:anywhere]">
            Version {preview.sourceAppVersion} · Build {preview.sourceBuild}
          </dd>
        </div>
        <div>
          <dt className="font-black uppercase">Values</dt>
          <dd>
            {preview.activeValueCount} active · {preview.customValueCount}{" "}
            custom
          </dd>
        </div>
        <div>
          <dt className="font-black uppercase">Progress</dt>
          <dd>
            {preview.totalComparisons} comparisons · Cycle{" "}
            {preview.currentCycle}
          </dd>
        </div>
        <div>
          <dt className="font-black uppercase">Achievements</dt>
          <dd>{preview.unlockedAchievementCount} unlocked</dd>
        </div>
        <div>
          <dt className="font-black uppercase">Language</dt>
          <dd>{preview.locale}</dd>
        </div>
      </dl>
      <p className="bg-mapache-vivid-primary-yellow text-mapache-vivid-dark my-6 border-4 border-black p-4 text-lg font-black">
        Replacing local data changes your values, rankings, battle history,
        achievements, and settings. A recovery backup is created first.
      </p>
      <div className="flex flex-col gap-4 sm:flex-row">
        <button
          type="button"
          disabled={activity !== null}
          onClick={onConfirmImport}
          className="bg-mapache-vivid-primary-orange min-h-14 flex-1 cursor-pointer border-4 border-black px-5 py-4 text-xl font-black text-white uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-wait disabled:opacity-60"
        >
          Replace Current Data
        </button>
        <button
          type="button"
          disabled={activity !== null}
          onClick={onCancelImport}
          className="bg-mapache-vivid-primary-cyan text-mapache-vivid-dark min-h-14 flex-1 cursor-pointer border-4 border-black px-5 py-4 text-xl font-black uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-wait disabled:opacity-60"
        >
          Cancel Import
        </button>
      </div>
    </section>
  )
}

export default function DataManagement({
  activity,
  issue,
  notice,
  preview,
  onCancelImport,
  onClose,
  onConfirmImport,
  onExport,
  onImportFile,
}: {
  activity: DataManagementActivity | null
  issue: string | null
  notice: string | null
  preview: WayvmImportPreview | null
  onCancelImport: () => void
  onClose: () => void
  onConfirmImport: () => void
  onExport: () => void
  onImportFile: (file: File) => void
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
          <ImportPreview
            activity={activity}
            preview={preview}
            onCancelImport={onCancelImport}
            onConfirmImport={onConfirmImport}
          />
        ) : (
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
              Export one complete backup of your values, progress, achievements,
              and settings. Importing stays local to this device.
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
        )}
      </div>
    </main>
  )
}

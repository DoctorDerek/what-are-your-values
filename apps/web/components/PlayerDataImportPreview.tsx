"use client"

import { formatWayvmImportTimestamp } from "@game/machines/src/WayvmImportPresentation"
import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"

export default function PlayerDataImportPreview({
  confirmLabel,
  isBusy,
  preview,
  replacementWarning,
  onCancelImport,
  onConfirmImport,
}: {
  confirmLabel: string
  isBusy: boolean
  preview: WayvmImportPreview
  replacementWarning: string
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
              {formatWayvmImportTimestamp(preview.exportedAt)}
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
        {replacementWarning}
      </p>
      <div className="flex flex-col gap-4 sm:flex-row">
        <button
          type="button"
          disabled={isBusy}
          onClick={onConfirmImport}
          className="bg-mapache-vivid-primary-orange min-h-14 flex-1 cursor-pointer border-4 border-black px-5 py-4 text-xl font-black text-white uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-wait disabled:opacity-60"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={onCancelImport}
          className="bg-mapache-vivid-primary-cyan text-mapache-vivid-dark min-h-14 flex-1 cursor-pointer border-4 border-black px-5 py-4 text-xl font-black uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[6px] active:translate-y-[6px] active:shadow-none disabled:cursor-wait disabled:opacity-60"
        >
          Cancel Import
        </button>
      </div>
    </section>
  )
}

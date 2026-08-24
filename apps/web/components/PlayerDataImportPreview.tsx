"use client"

import { CANONICAL_VALUES } from "@game/data/src/CanonicalValues"
import { playerDataPortabilityCopy } from "@game/machines/src/PlayerDataPortabilityCopy"
import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { useEffect, useRef, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

function PreviewFact({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="border-4 border-black bg-white p-4">
      <dt className="text-sm font-black tracking-wide uppercase">{label}</dt>
      <dd className="mt-1 min-w-0 text-lg font-bold [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  )
}

export default function PlayerDataImportPreview({
  confirmLabel = playerDataPortabilityCopy.importReplaceAction,
  isBusy,
  preview,
  title = playerDataPortabilityCopy.importPreviewTitle,
  warning = playerDataPortabilityCopy.importPreviewWarning,
  onCancel,
  onConfirm,
}: {
  confirmLabel?: string
  isBusy: boolean
  preview: WayvmImportPreview
  title?: string
  warning?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const formattedExportTimestamp = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(preview.exportedAt))

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section
      aria-labelledby="import-preview-heading"
      aria-busy={isBusy}
      className="border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] sm:p-8"
    >
      <h2
        ref={headingRef}
        id="import-preview-heading"
        tabIndex={-1}
        className="text-mapache-vivid-dark border-b-4 border-black pb-4 text-3xl font-black uppercase outline-none sm:text-4xl"
      >
        {title}
      </h2>

      <dl className="text-mapache-vivid-dark my-6 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <PreviewFact label="Backup Created">
          <time dateTime={preview.exportedAt}>{formattedExportTimestamp}</time>
        </PreviewFact>
        <PreviewFact label="Source Application">
          Version {preview.sourceAppVersion}
        </PreviewFact>
        <PreviewFact label="Source Build">{preview.sourceBuild}</PreviewFact>
        <PreviewFact label="Save Schema">
          Version {preview.saveSchemaVersion}
        </PreviewFact>
        <PreviewFact label="Total Comparisons">
          {preview.totalComparisons}
        </PreviewFact>
        <PreviewFact label="Canonical Catalog">
          {preview.canonicalCatalogVersion}
        </PreviewFact>
        <PreviewFact label="Included Values">
          {CANONICAL_VALUES.length}
        </PreviewFact>
        <PreviewFact label="Custom Values">
          {preview.customValueCount}
        </PreviewFact>
        <PreviewFact label="Active Values">
          {preview.activeValueCount}
        </PreviewFact>
        <PreviewFact label="Current Cycle">{preview.currentCycle}</PreviewFact>
        <PreviewFact label="Cycle Pairings">
          {preview.activePairCycleSize}
        </PreviewFact>
        <PreviewFact label="Deck Revision">{preview.deckRevision}</PreviewFact>
        <PreviewFact label="Progress Generation">
          {preview.progressGeneration}
        </PreviewFact>
        <PreviewFact label="Achievements">
          {preview.unlockedAchievementCount}
        </PreviewFact>
        <PreviewFact label="Achievement Progress Generation">
          {preview.achievementProgressGeneration}
        </PreviewFact>
        <PreviewFact label="Language">{preview.locale}</PreviewFact>
        <PreviewFact label="Replacement">
          Replaces current data on this device
        </PreviewFact>
      </dl>

      <p className="bg-mapache-vivid-secondary-gold text-mapache-vivid-black border-4 border-black p-4 text-lg font-black">
        {warning}
      </p>

      <div className="mt-6 flex flex-col gap-4 xl:flex-row">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isBusy}
          onClick={onCancel}
          className="flex-1"
        >
          {playerDataPortabilityCopy.importCancelAction}
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={isBusy}
          onClick={onConfirm}
          className="flex-1"
        >
          {confirmLabel}
        </Button>
      </div>
    </section>
  )
}

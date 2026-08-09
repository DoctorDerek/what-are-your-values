import { CANONICAL_VALUES } from "@game/data/src/CanonicalValues"
import { playerDataPortabilityCopy } from "@game/machines/src/PlayerDataPortabilityCopy"
import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import type { ReactNode } from "react"
import { View } from "react-native"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

function PreviewFact({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}) {
  return (
    <View className="border-4 border-black bg-white p-4">
      <Text className="text-sm font-black tracking-wide text-black uppercase">
        {label}
      </Text>
      <Text className="mt-1 text-lg leading-7 font-bold text-black">
        {children}
      </Text>
    </View>
  )
}

export default function NativePlayerDataImportPreview({
  isBusy,
  preview,
  onCancel,
  onConfirm,
}: {
  readonly isBusy: boolean
  readonly preview: WayvmImportPreview
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) {
  const formattedExportTimestamp = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(preview.exportedAt))

  return (
    <View className="gap-5 border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000]">
      <Text
        variant="h2"
        className="border-b-4 border-black text-black uppercase"
      >
        {playerDataPortabilityCopy.importPreviewTitle}
      </Text>

      <View className="gap-3">
        <PreviewFact label="Backup Created">
          {formattedExportTimestamp}
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
      </View>

      <Text
        accessibilityRole="alert"
        className="bg-mapache-vivid-secondary-gold border-4 border-black p-4 text-lg leading-7 font-black text-black"
      >
        {playerDataPortabilityCopy.importPreviewWarning}
      </Text>

      <View className="gap-4">
        <Button disabled={isBusy} variant="outline" onPress={onCancel}>
          <Text>{playerDataPortabilityCopy.importCancelAction}</Text>
        </Button>
        <Button disabled={isBusy} onPress={onConfirm}>
          <Text>{playerDataPortabilityCopy.importReplaceAction}</Text>
        </Button>
      </View>
    </View>
  )
}

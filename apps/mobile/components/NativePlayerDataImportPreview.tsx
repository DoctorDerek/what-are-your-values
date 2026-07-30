import { formatWayvmImportTimestamp } from "@game/machines/src/WayvmImportPresentation"
import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { StyleSheet, Text, View } from "react-native"
import MapacheButton from "@/components/MapacheButton"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

function PreviewFact({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  )
}

export default function NativePlayerDataImportPreview({
  confirmLabel,
  isBusy,
  onCancelImport,
  onConfirmImport,
  preview,
  replacementWarning,
}: {
  readonly confirmLabel: string
  readonly isBusy: boolean
  readonly onCancelImport: () => void
  readonly onConfirmImport: () => void
  readonly preview: WayvmImportPreview
  readonly replacementWarning: string
}) {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.heading}>
        Review Import
      </Text>
      <Text style={styles.description}>
        This backup has passed its integrity and compatibility checks.
      </Text>
      <View style={styles.facts}>
        <PreviewFact
          label="Exported"
          value={formatWayvmImportTimestamp(preview.exportedAt)}
        />
        <PreviewFact
          label="Source"
          value={`Version ${preview.sourceAppVersion} · Build ${preview.sourceBuild}`}
        />
        <PreviewFact
          label="Values"
          value={`${preview.activeValueCount} active · ${preview.customValueCount} custom`}
        />
        <PreviewFact
          label="Progress"
          value={`${preview.totalComparisons} comparisons · Cycle ${preview.currentCycle}`}
        />
        <PreviewFact
          label="Achievements"
          value={`${preview.unlockedAchievementCount} unlocked`}
        />
        <PreviewFact label="Language" value={preview.locale} />
      </View>
      <Text accessibilityRole="alert" style={styles.warning}>
        {replacementWarning}
      </Text>
      <View style={styles.actions}>
        <MapacheButton
          disabled={isBusy}
          label={confirmLabel}
          onPress={onConfirmImport}
        />
        <MapacheButton
          disabled={isBusy}
          label="Cancel Import"
          onPress={onCancelImport}
          tone="cyan"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  actions: {
    gap: mapacheSpacing.standard,
  },
  container: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    gap: mapacheSpacing.standard,
    padding: mapacheSpacing.standard,
  },
  description: {
    color: mapacheColors.charcoal,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 27,
  },
  fact: {
    gap: 4,
  },
  factLabel: {
    color: mapacheColors.charcoal,
    fontSize: 15,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  facts: {
    gap: mapacheSpacing.standard,
  },
  factValue: {
    color: mapacheColors.charcoal,
    fontSize: 17,
    fontWeight: "700",
  },
  heading: {
    borderBottomColor: mapacheColors.black,
    borderBottomWidth: mapacheLayout.borderWidth,
    color: mapacheColors.charcoal,
    fontSize: 30,
    fontWeight: "900",
    paddingBottom: mapacheSpacing.standard,
    textTransform: "uppercase",
  },
  warning: {
    backgroundColor: mapacheColors.gold,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    color: mapacheColors.charcoal,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 25,
    padding: mapacheSpacing.standard,
  },
})

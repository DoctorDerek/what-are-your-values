import type { PlayerDataResetKind } from "@game/machines/src/PlayerDataReset"
import { playerDataResetCopy } from "@game/machines/src/PlayerDataResetCopy"
import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import MapacheButton from "@/components/MapacheButton"
import MapacheScreen from "@/components/MapacheScreen"
import NativePlayerDataImportPreview from "@/components/NativePlayerDataImportPreview"
import NativeResetReview from "@/components/NativeResetReview"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

export type NativeDataManagementActivity =
  | "Checking backup…"
  | "Creating recovery backup…"
  | "Exporting backup…"
  | "Applying reset…"
  | "Deleting local data…"
  | "Replacing local data…"

export default function NativeDataManagement({
  activity,
  canDeleteCustomValues,
  issue,
  notice,
  onCancelImport,
  onCancelReset,
  onClose,
  onConfirmImport,
  onConfirmReset,
  onExport,
  onImport,
  onOpenReset,
  preview,
  resetKind,
}: {
  readonly activity: NativeDataManagementActivity | null
  readonly canDeleteCustomValues: boolean
  readonly issue: string | null
  readonly notice: string | null
  readonly onCancelImport: () => void
  readonly onCancelReset: () => void
  readonly onClose: () => void
  readonly onConfirmImport: () => void
  readonly onConfirmReset: (deleteAllDataAcknowledged: boolean) => void
  readonly onExport: () => void
  readonly onImport: () => void
  readonly onOpenReset: (resetKind: PlayerDataResetKind) => void
  readonly preview: WayvmImportPreview | null
  readonly resetKind: PlayerDataResetKind | null
}) {
  const isBusy = activity !== null

  return (
    <MapacheScreen>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={styles.title}>
          Manage Your Data
        </Text>
        <MapacheButton
          disabled={isBusy}
          label="Back to Your Values"
          onPress={onClose}
          tone="cyan"
        />
      </View>
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View accessibilityState={{ busy: isBusy }} style={styles.content}>
          {activity ? (
            <Text accessibilityLiveRegion="polite" style={styles.activity}>
              {activity}
            </Text>
          ) : null}
          {notice ? (
            <Text accessibilityLiveRegion="polite" style={styles.notice}>
              {notice}
            </Text>
          ) : null}
          {issue ? (
            <Text accessibilityRole="alert" style={styles.issue}>
              {issue}
            </Text>
          ) : null}

          {preview ? (
            <NativePlayerDataImportPreview
              confirmLabel="Replace Current Data"
              isBusy={isBusy}
              onCancelImport={onCancelImport}
              onConfirmImport={onConfirmImport}
              preview={preview}
              replacementWarning="Replacing local data changes your values, rankings, battle history, achievements, and settings. A recovery backup is created first."
            />
          ) : resetKind ? (
            <NativeResetReview
              key={resetKind}
              activity={activity}
              onCancelReset={onCancelReset}
              onConfirmReset={onConfirmReset}
              onExport={onExport}
              resetKind={resetKind}
            />
          ) : (
            <>
              <View style={styles.panel}>
                <Text accessibilityRole="header" style={styles.heading}>
                  Private Backups
                </Text>
                <Text style={styles.description}>
                  Export one complete backup of your values, progress,
                  achievements, and settings. Importing stays local to this
                  device.
                </Text>
                <View style={styles.actions}>
                  <MapacheButton
                    disabled={isBusy}
                    label="Export Data"
                    onPress={onExport}
                    tone="purple"
                  />
                  <MapacheButton
                    disabled={isBusy}
                    label="Import Data"
                    onPress={onImport}
                    tone="cyan"
                  />
                </View>
              </View>
              <View style={styles.resetPanel}>
                <Text accessibilityRole="header" style={styles.resetHeading}>
                  Reset or Delete
                </Text>
                <Text style={styles.resetDescription}>
                  Each action changes a different part of your local data.
                  Review the exact scope before confirming.
                </Text>
                <View style={styles.actions}>
                  {(
                    Object.keys(
                      playerDataResetCopy,
                    ) as readonly PlayerDataResetKind[]
                  ).map((candidateResetKind) => {
                    const isUnavailableCustomValueDelete =
                      candidateResetKind === "delete-all-custom-values" &&
                      !canDeleteCustomValues

                    return (
                      <MapacheButton
                        key={candidateResetKind}
                        disabled={isBusy || isUnavailableCustomValueDelete}
                        label={playerDataResetCopy[candidateResetKind].action}
                        onPress={() => onOpenReset(candidateResetKind)}
                      />
                    )
                  })}
                </View>
                {!canDeleteCustomValues ? (
                  <Text style={styles.resetDescription}>
                    There are no Custom Values to delete.
                  </Text>
                ) : null}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </MapacheScreen>
  )
}

const styles = StyleSheet.create({
  actions: {
    gap: mapacheSpacing.standard,
  },
  activity: {
    backgroundColor: mapacheColors.cyan,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    color: mapacheColors.white,
    fontSize: 18,
    fontWeight: "900",
    padding: mapacheSpacing.standard,
    textTransform: "uppercase",
  },
  content: {
    gap: mapacheSpacing.standard,
    paddingBottom: mapacheLayout.panelShadowOffset,
  },
  description: {
    color: mapacheColors.charcoal,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 27,
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
  issue: {
    backgroundColor: mapacheColors.orange,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    color: mapacheColors.white,
    fontSize: 18,
    fontWeight: "900",
    padding: mapacheSpacing.standard,
  },
  notice: {
    backgroundColor: mapacheColors.green,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    color: mapacheColors.white,
    fontSize: 18,
    fontWeight: "900",
    padding: mapacheSpacing.standard,
  },
  panel: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    gap: mapacheSpacing.standard,
    padding: mapacheSpacing.standard,
  },
  resetDescription: {
    color: mapacheColors.white,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 27,
  },
  resetHeading: {
    borderBottomColor: mapacheColors.orange,
    borderBottomWidth: mapacheLayout.borderWidth,
    color: mapacheColors.orange,
    fontSize: 30,
    fontWeight: "900",
    paddingBottom: mapacheSpacing.standard,
    textTransform: "uppercase",
  },
  resetPanel: {
    backgroundColor: mapacheColors.black,
    borderColor: mapacheColors.orange,
    borderWidth: mapacheLayout.borderWidth,
    gap: mapacheSpacing.standard,
    padding: mapacheSpacing.standard,
  },
  title: {
    color: mapacheColors.cyan,
    flexShrink: 1,
    fontSize: 36,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mapacheSpacing.standard,
    justifyContent: "space-between",
    marginBottom: mapacheSpacing.standard,
  },
})

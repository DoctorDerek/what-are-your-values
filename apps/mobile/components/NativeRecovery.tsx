import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { useState } from "react"
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native"
import MapacheButton from "@/components/MapacheButton"
import MapacheScreen from "@/components/MapacheScreen"
import NativeOperationMessages from "@/components/NativeOperationMessages"
import NativePlayerDataImportPreview from "@/components/NativePlayerDataImportPreview"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

export type NativeRecoveryActivity =
  | "Checking backup…"
  | "Deleting local data…"
  | "Exporting current data…"
  | "Exporting unreadable data…"
  | "Replacing unreadable data…"

export type NativeRecoveryImportSource =
  "last-known-good" | "selected-backup" | null

export default function NativeRecovery({
  activity,
  canExportCurrentData,
  canRetry,
  canReturnWithoutNewChanges,
  hasCapturedData,
  hasLastKnownGoodSave,
  importSource,
  issue,
  notice,
  onCancelImport,
  onConfirmImport,
  onDeleteAllData,
  onExportCurrentData,
  onExportUnreadableData,
  onImport,
  onRestoreLastKnownGoodSave,
  onRetry,
  onReturnWithoutNewChanges,
  preview,
}: {
  readonly activity: NativeRecoveryActivity | null
  readonly canExportCurrentData: boolean
  readonly canRetry: boolean
  readonly canReturnWithoutNewChanges: boolean
  readonly hasCapturedData: boolean
  readonly hasLastKnownGoodSave: boolean
  readonly importSource: NativeRecoveryImportSource
  readonly issue: string | null
  readonly notice: string | null
  readonly onCancelImport: () => void
  readonly onConfirmImport: () => void
  readonly onDeleteAllData: (acknowledged: boolean) => void
  readonly onExportCurrentData: () => void
  readonly onExportUnreadableData: () => void
  readonly onImport: () => void
  readonly onRestoreLastKnownGoodSave: () => void
  readonly onRetry: () => void
  readonly onReturnWithoutNewChanges: () => void
  readonly preview: WayvmImportPreview | null
}) {
  const [deleteAllDataAcknowledged, setDeleteAllDataAcknowledged] =
    useState(false)
  const isBusy = activity !== null

  if (!hasCapturedData) {
    const isStorageWriteFailure = canExportCurrentData

    return (
      <MapacheScreen>
        <ScrollView
          alwaysBounceVertical={false}
          contentContainerStyle={styles.centeredContent}
        >
          <Text accessibilityRole="header" style={styles.title}>
            {isStorageWriteFailure
              ? "Progress Cannot Be Saved Reliably"
              : "We couldn’t safely load your values."}
          </Text>
          <Text style={styles.introduction}>
            {isStorageWriteFailure
              ? "WAYVM cannot currently write to device storage. Keep this screen open while you export a backup or free storage. Continuing without a reliable save could lose new progress."
              : "Your saved data was left unchanged. Try again after checking that this device can access local storage."}
          </Text>
          <NativeOperationMessages
            activity={activity}
            issue={issue}
            notice={notice}
          />
          <View style={styles.actions}>
            {canExportCurrentData ? (
              <MapacheButton
                disabled={isBusy}
                label="Export Current Data"
                onPress={onExportCurrentData}
                tone="purple"
              />
            ) : null}
            {canRetry ? (
              <MapacheButton
                disabled={isBusy}
                label="Try Again"
                onPress={onRetry}
                tone="cyan"
              />
            ) : null}
            {canReturnWithoutNewChanges ? (
              <MapacheButton
                disabled={isBusy}
                label="Return Without New Changes"
                onPress={onReturnWithoutNewChanges}
                tone="green"
              />
            ) : null}
          </View>
        </ScrollView>
      </MapacheScreen>
    )
  }

  return (
    <MapacheScreen>
      <Text accessibilityRole="header" style={styles.title}>
        Your Saved Data Needs Attention
      </Text>
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={styles.content}
      >
        <NativeOperationMessages
          activity={activity}
          issue={issue}
          notice={notice}
        />
        {preview ? (
          <NativePlayerDataImportPreview
            confirmLabel={
              importSource === "last-known-good"
                ? "Restore Last Known-Good Save"
                : "Import Backup"
            }
            isBusy={isBusy}
            onCancelImport={onCancelImport}
            onConfirmImport={onConfirmImport}
            preview={preview}
            replacementWarning={
              importSource === "last-known-good"
                ? "Restore the last known-good save? The unreadable current save will be preserved until restoration succeeds."
                : "Import this backup? The unreadable current save will be preserved until replacement succeeds."
            }
          />
        ) : (
          <>
            <View style={styles.panel}>
              <Text style={styles.panelText}>
                WAYVM could not safely load the current save on this device.
                Nothing has been erased.
              </Text>
              <Text style={styles.panelText}>
                You can restore the last known-good save, import another backup,
                download the unreadable data for recovery, or choose Delete All
                Data.
              </Text>
              {!hasLastKnownGoodSave ? (
                <Text style={styles.warning}>
                  No last known-good save is available. You can import a backup,
                  export the unreadable data, or choose Delete All Data.
                </Text>
              ) : null}
              <View style={styles.actions}>
                {hasLastKnownGoodSave ? (
                  <MapacheButton
                    disabled={isBusy}
                    label="Restore Last Known-Good Save"
                    onPress={onRestoreLastKnownGoodSave}
                    tone="green"
                  />
                ) : null}
                <MapacheButton
                  disabled={isBusy}
                  label="Import Backup"
                  onPress={onImport}
                  tone="cyan"
                />
                <MapacheButton
                  disabled={isBusy}
                  label="Export Unreadable Data"
                  onPress={onExportUnreadableData}
                  tone="purple"
                />
              </View>
              <Text style={styles.panelText}>
                Exported unreadable data is a diagnostic recovery file, not an
                importable player backup.
              </Text>
            </View>
            <View style={styles.deletePanel}>
              <Text accessibilityRole="header" style={styles.deleteHeading}>
                Delete All Data
              </Text>
              <Text style={styles.deleteDescription}>
                This permanently removes every WAYVM player-data record from
                this device and returns to Introduction. Export the unreadable
                data first if you may need it for recovery.
              </Text>
              <View style={styles.acknowledgment}>
                <Switch
                  accessibilityLabel="I understand that this cannot be undone."
                  disabled={isBusy}
                  onValueChange={setDeleteAllDataAcknowledged}
                  thumbColor={mapacheColors.white}
                  trackColor={{
                    false: mapacheColors.charcoal,
                    true: mapacheColors.orange,
                  }}
                  value={deleteAllDataAcknowledged}
                />
                <Text style={styles.acknowledgmentText}>
                  I understand that this cannot be undone.
                </Text>
              </View>
              <MapacheButton
                disabled={isBusy || !deleteAllDataAcknowledged}
                label="Delete All Data"
                onPress={() => onDeleteAllData(deleteAllDataAcknowledged)}
              />
            </View>
          </>
        )}
      </ScrollView>
    </MapacheScreen>
  )
}

const styles = StyleSheet.create({
  acknowledgment: {
    alignItems: "center",
    backgroundColor: mapacheColors.gold,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    flexDirection: "row",
    gap: mapacheSpacing.standard,
    padding: mapacheSpacing.standard,
  },
  acknowledgmentText: {
    color: mapacheColors.charcoal,
    flex: 1,
    fontSize: 17,
    fontWeight: "900",
  },
  actions: {
    gap: mapacheSpacing.standard,
  },
  centeredContent: {
    flexGrow: 1,
    gap: mapacheSpacing.spacious,
    justifyContent: "center",
    paddingBottom: mapacheLayout.panelShadowOffset,
  },
  content: {
    gap: mapacheSpacing.standard,
    paddingBottom: mapacheLayout.panelShadowOffset,
  },
  deleteDescription: {
    color: mapacheColors.white,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 25,
  },
  deleteHeading: {
    borderBottomColor: mapacheColors.orange,
    borderBottomWidth: mapacheLayout.borderWidth,
    color: mapacheColors.orange,
    fontSize: 30,
    fontWeight: "900",
    paddingBottom: mapacheSpacing.standard,
    textTransform: "uppercase",
  },
  deletePanel: {
    backgroundColor: mapacheColors.black,
    borderColor: mapacheColors.orange,
    borderWidth: mapacheLayout.borderWidth,
    gap: mapacheSpacing.standard,
    padding: mapacheSpacing.standard,
  },
  introduction: {
    color: mapacheColors.white,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 30,
    textAlign: "center",
  },
  panel: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    gap: mapacheSpacing.standard,
    padding: mapacheSpacing.standard,
  },
  panelText: {
    color: mapacheColors.charcoal,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 25,
  },
  title: {
    color: mapacheColors.cyan,
    fontSize: 38,
    fontWeight: "900",
    marginBottom: mapacheSpacing.standard,
    textAlign: "center",
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

import type { PlayerDataResetKind } from "@game/machines/src/PlayerDataReset"
import { playerDataResetCopy } from "@game/machines/src/PlayerDataResetCopy"
import { useState } from "react"
import { StyleSheet, Switch, Text, View } from "react-native"
import MapacheButton from "@/components/MapacheButton"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

export default function NativeResetReview({
  activity,
  onCancelReset,
  onConfirmReset,
  onExport,
  resetKind,
}: {
  readonly activity: string | null
  readonly onCancelReset: () => void
  readonly onConfirmReset: (deleteAllDataAcknowledged: boolean) => void
  readonly onExport: () => void
  readonly resetKind: PlayerDataResetKind
}) {
  const [deleteAllDataAcknowledged, setDeleteAllDataAcknowledged] =
    useState(false)
  const copy = playerDataResetCopy[resetKind]
  const requiresAcknowledgment = resetKind === "delete-all-data"
  const isBusy = activity !== null

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.heading}>
        {copy.title}
      </Text>
      {copy.paragraphs.map((paragraph) => (
        <Text key={paragraph} style={styles.paragraph}>
          {paragraph}
        </Text>
      ))}
      {requiresAcknowledgment ? (
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
      ) : null}
      <View style={styles.actions}>
        <MapacheButton
          disabled={isBusy}
          label="Export Data"
          onPress={onExport}
          tone="purple"
        />
        <MapacheButton
          disabled={isBusy}
          label="Cancel"
          onPress={onCancelReset}
          tone="cyan"
        />
        <MapacheButton
          disabled={
            isBusy || (requiresAcknowledgment && !deleteAllDataAcknowledged)
          }
          label={copy.action}
          onPress={() => onConfirmReset(deleteAllDataAcknowledged)}
        />
      </View>
    </View>
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
  container: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    gap: mapacheSpacing.standard,
    padding: mapacheSpacing.standard,
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
  paragraph: {
    color: mapacheColors.charcoal,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 25,
  },
})

import { StyleSheet, Text, View } from "react-native"
import MapacheButton from "@/components/MapacheButton"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

export default function NativeCustomValueDeleteConfirmation({
  displayName,
  isPersistencePending,
  onCancel,
  onConfirm,
}: {
  readonly displayName: string
  readonly isPersistencePending: boolean
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) {
  return (
    <View
      accessibilityLabel={`Remove ${displayName}?`}
      accessibilityRole="alert"
      style={styles.container}
    >
      <Text accessibilityRole="header" style={styles.heading}>
        Remove {displayName}?
      </Text>
      <Text style={styles.description}>
        This permanently removes the name, definition, and progress for this
        Custom Value. Retained values keep their levels and experience.
      </Text>
      <View style={styles.actions}>
        <MapacheButton
          containerStyle={styles.action}
          disabled={isPersistencePending}
          label="Cancel"
          onPress={onCancel}
          tone="purple"
        />
        <MapacheButton
          containerStyle={styles.action}
          disabled={isPersistencePending}
          label={isPersistencePending ? "Deleting…" : "Delete Value"}
          onPress={onConfirm}
          tone="red"
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: mapacheSpacing.standard,
  },
  container: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.red,
    borderWidth: mapacheLayout.borderWidth,
    gap: mapacheSpacing.standard,
    padding: mapacheSpacing.standard,
  },
  description: {
    color: mapacheColors.charcoal,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 25,
  },
  heading: {
    color: mapacheColors.charcoal,
    fontSize: 24,
    fontWeight: "900",
    textTransform: "uppercase",
  },
})

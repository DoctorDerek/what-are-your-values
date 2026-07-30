import { StyleSheet, View } from "react-native"
import MapacheButton from "@/components/MapacheButton"
import { mapacheSpacing } from "@/theme/MapacheVividTheme"

export default function NativeBattleActionBar({
  canRedo,
  canStop,
  canUndo,
  onRedo,
  onStop,
  onUndo,
}: {
  readonly canRedo: boolean
  readonly canStop: boolean
  readonly canUndo: boolean
  readonly onRedo: () => void
  readonly onStop: () => void
  readonly onUndo: () => void
}) {
  return (
    <View style={styles.container}>
      <MapacheButton
        containerStyle={styles.action}
        disabled={!canUndo}
        label="Undo"
        onPress={onUndo}
        tone="charcoal"
      />
      <MapacheButton
        containerStyle={styles.action}
        disabled={!canRedo}
        label="Redo"
        onPress={onRedo}
        tone="charcoal"
      />
      <MapacheButton
        containerStyle={styles.action}
        disabled={!canStop}
        label="Stop"
        onPress={onStop}
        tone="red"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
  },
  container: {
    flexDirection: "row",
    gap: mapacheSpacing.compact,
  },
})

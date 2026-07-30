import { StyleSheet, View } from "react-native"
import MapacheButton from "@/components/MapacheButton"
import { mapacheSpacing } from "@/theme/MapacheVividTheme"

export default function NativeValueActionRail({
  onAddCustomValue,
  onBrowseAllValues,
  onManageData,
  onOpenAchievements,
  onStartBattle,
}: {
  readonly onAddCustomValue: () => void
  readonly onBrowseAllValues: () => void
  readonly onManageData: () => void
  readonly onOpenAchievements: () => void
  readonly onStartBattle: () => void
}) {
  return (
    <View style={styles.container}>
      <MapacheButton label="Battle" onPress={onStartBattle} />
      <MapacheButton
        label="Browse All Values"
        onPress={onBrowseAllValues}
        tone="cyan"
      />
      <MapacheButton
        label="Add Custom Value"
        onPress={onAddCustomValue}
        tone="purple"
      />
      <MapacheButton
        label="Achievements"
        onPress={onOpenAchievements}
        tone="gold"
      />
      <MapacheButton label="Manage Data" onPress={onManageData} tone="green" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: mapacheSpacing.standard,
  },
})

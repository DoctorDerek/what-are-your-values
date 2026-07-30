import { getValueDisplayName } from "@game/data/src/Value"
import type { RankedValue } from "@game/data/src/ValueRanking"
import { Pressable, StyleSheet, Text, View } from "react-native"
import NativeValueLevelProgress from "@/components/NativeValueLevelProgress"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

export default function NativeValueRow({
  onPress,
  rankedValue,
  showRank,
}: {
  readonly onPress: () => void
  readonly rankedValue: RankedValue
  readonly showRank: boolean
}) {
  const { definition, progress, rank } = rankedValue
  const displayName = getValueDisplayName(definition)

  return (
    <Pressable
      accessibilityHint="Opens this value’s complete details."
      accessibilityLabel={`Open ${displayName} in All Values`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={styles.heading}>
        {showRank ? (
          <Text accessibilityLabel={`Rank ${rank}`} style={styles.rank}>
            #{rank}
          </Text>
        ) : null}
        <Text style={styles.name}>{displayName}</Text>
        {definition.kind === "custom" ? (
          <Text style={styles.customLabel}>Custom</Text>
        ) : null}
      </View>
      <NativeValueLevelProgress totalXp={progress.totalXp} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  customLabel: {
    backgroundColor: mapacheColors.purple,
    borderColor: mapacheColors.black,
    borderWidth: 2,
    color: mapacheColors.white,
    fontSize: 13,
    fontWeight: "900",
    paddingHorizontal: mapacheSpacing.compact,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  heading: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mapacheSpacing.compact,
  },
  name: {
    color: mapacheColors.charcoal,
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 24,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  pressed: {
    opacity: 0.8,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  rank: {
    backgroundColor: mapacheColors.purple,
    borderColor: mapacheColors.black,
    borderWidth: 2,
    color: mapacheColors.white,
    fontSize: 20,
    fontWeight: "900",
    paddingHorizontal: mapacheSpacing.compact,
    paddingVertical: 4,
  },
  row: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    gap: mapacheSpacing.standard,
    padding: mapacheSpacing.standard,
  },
})

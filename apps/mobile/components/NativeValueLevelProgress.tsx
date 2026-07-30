import { getLevelProgressFromXP } from "@game/utils/src/LevelMath"
import { StyleSheet, Text, View } from "react-native"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

export default function NativeValueLevelProgress({
  totalXp,
}: {
  readonly totalXp: number
}) {
  const { level, earnedXpTowardNextLevel, requiredXpForNextLevel } =
    getLevelProgressFromXP(totalXp)
  const progressWidth =
    `${(earnedXpTowardNextLevel / requiredXpForNextLevel) * 100}%` as const

  return (
    <View
      accessibilityLabel={`Level ${level}: ${earnedXpTowardNextLevel} of ${requiredXpForNextLevel} XP toward Level ${level + 1}`}
      accessibilityRole="progressbar"
      accessibilityValue={{
        max: requiredXpForNextLevel,
        min: 0,
        now: earnedXpTowardNextLevel,
      }}
      style={styles.container}
    >
      <View style={styles.labels}>
        <Text style={styles.level}>Level {level}</Text>
        <Text style={styles.xp}>
          {earnedXpTowardNextLevel}/{requiredXpForNextLevel} XP
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: progressWidth }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    paddingHorizontal: mapacheSpacing.compact,
    paddingVertical: mapacheSpacing.compact,
    width: "100%",
  },
  fill: {
    backgroundColor: mapacheColors.raspberry,
    height: "100%",
  },
  labels: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  level: {
    color: mapacheColors.raspberry,
    fontSize: 18,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  track: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: 2,
    height: 12,
    marginTop: mapacheSpacing.compact,
    overflow: "hidden",
  },
  xp: {
    color: mapacheColors.raspberry,
    fontSize: 14,
    fontWeight: "900",
  },
})

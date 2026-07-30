import type { AchievementDefinition } from "@game/machines/src/AchievementCatalog"
import { formatAchievementUnlockedDate } from "@game/machines/src/AchievementPresentation"
import type { AchievementUnlock } from "@game/machines/src/AchievementState"
import { StyleSheet, Text, View } from "react-native"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

export default function NativeAchievementCard({
  achievement,
  progress,
  unlock,
}: {
  readonly achievement: AchievementDefinition
  readonly progress: string
  readonly unlock: AchievementUnlock | null
}) {
  return (
    <View
      accessibilityLabel={`${achievement.title}, ${unlock ? "unlocked" : "locked"}`}
      style={[styles.card, unlock ? styles.unlocked : null]}
    >
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          {achievement.title}
        </Text>
        <Text style={styles.status}>{unlock ? "Unlocked" : "Locked"}</Text>
      </View>
      <Text style={styles.description}>{achievement.description}</Text>
      <Text style={styles.progress}>{progress}</Text>
      {unlock ? (
        <Text style={styles.progress}>
          Unlocked {formatAchievementUnlockedDate(unlock.unlockedAt)}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    gap: mapacheSpacing.compact,
    padding: mapacheSpacing.standard,
  },
  description: {
    color: mapacheColors.charcoal,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 25,
  },
  heading: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mapacheSpacing.compact,
    justifyContent: "space-between",
  },
  progress: {
    color: mapacheColors.charcoal,
    fontSize: 16,
    fontWeight: "900",
  },
  status: {
    backgroundColor: mapacheColors.black,
    borderColor: mapacheColors.black,
    borderWidth: 2,
    color: mapacheColors.white,
    fontSize: 14,
    fontWeight: "900",
    paddingHorizontal: mapacheSpacing.compact,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  title: {
    color: mapacheColors.charcoal,
    flexShrink: 1,
    fontSize: 23,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  unlocked: {
    backgroundColor: mapacheColors.gold,
  },
})

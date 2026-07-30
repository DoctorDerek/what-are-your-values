import { ACHIEVEMENT_CATALOG } from "@game/machines/src/AchievementCatalog"
import { getAchievementProgress } from "@game/machines/src/AchievementPresentation"
import type { AchievementState } from "@game/machines/src/AchievementState"
import type { BattleProfile } from "@game/machines/src/BattleProfile"
import { FlatList, StyleSheet, Text, View } from "react-native"
import MapacheButton from "@/components/MapacheButton"
import MapacheScreen from "@/components/MapacheScreen"
import NativeAchievementCard from "@/components/NativeAchievementCard"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

export default function NativeAchievements({
  achievementState,
  battleProfile,
  onClose,
}: {
  readonly achievementState: AchievementState
  readonly battleProfile: BattleProfile
  readonly onClose: () => void
}) {
  const unlockById = new Map(
    achievementState.unlocks.map((unlock) => [unlock.id, unlock]),
  )

  return (
    <MapacheScreen>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={styles.title}>
          Achievements
        </Text>
        <MapacheButton
          label="Back to Your Values"
          onPress={onClose}
          tone="cyan"
        />
      </View>
      <FlatList
        contentContainerStyle={styles.list}
        data={ACHIEVEMENT_CATALOG}
        keyExtractor={({ id }) => id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.description}>
              Clear milestones from your private, offline progress. Achievements
              do not compare you with anyone else.
            </Text>
            <Text accessibilityLiveRegion="polite" style={styles.summary}>
              {achievementState.unlocks.length} of {ACHIEVEMENT_CATALOG.length}{" "}
              unlocked
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <NativeAchievementCard
            achievement={item}
            progress={getAchievementProgress({
              achievement: item,
              achievementState,
              battleProfile,
            })}
            unlock={unlockById.get(item.id) ?? null}
          />
        )}
      />
    </MapacheScreen>
  )
}

const styles = StyleSheet.create({
  description: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    color: mapacheColors.charcoal,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 27,
    padding: mapacheSpacing.standard,
  },
  header: {
    gap: mapacheSpacing.standard,
  },
  list: {
    gap: mapacheSpacing.standard,
    paddingBottom: mapacheLayout.panelShadowOffset,
  },
  summary: {
    backgroundColor: mapacheColors.green,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    color: mapacheColors.white,
    fontSize: 19,
    fontWeight: "900",
    padding: mapacheSpacing.standard,
    textTransform: "uppercase",
  },
  title: {
    color: mapacheColors.cyan,
    flexShrink: 1,
    fontSize: 38,
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

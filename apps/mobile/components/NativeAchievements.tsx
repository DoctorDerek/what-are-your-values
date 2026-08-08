import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import { FlatList, View } from "react-native"
import MapacheScreen from "@/components/MapacheScreen"
import NativeAchievementCard from "@/components/NativeAchievementCard"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

export default function NativeAchievements({
  achievements,
  onClose,
}: {
  readonly achievements: readonly AchievementPresentation[]
  readonly onClose: () => void
}) {
  const unlockedCount = achievements.filter(
    ({ status }) => status === "unlocked",
  ).length

  return (
    <MapacheScreen>
      <View className="gap-4 border-b-4 border-black p-4">
        <Text
          variant="h1"
          className="text-mapache-vivid-primary-cyan text-left text-4xl uppercase"
        >
          Achievements
        </Text>
        <Button variant="secondary" onPress={onClose}>
          <Text>Back to Your Values</Text>
        </Button>
      </View>
      <FlatList
        className="flex-1 px-4"
        contentContainerClassName="gap-4 py-5 pb-10"
        data={achievements}
        keyExtractor={({ id }) => id}
        ListHeaderComponent={
          <View className="gap-4">
            <View className="border-4 border-black bg-white p-4 shadow-[5px_5px_0px_0px_#000000]">
              <Text
                accessibilityRole="header"
                className="text-3xl font-black text-black uppercase"
              >
                Local Milestones
              </Text>
              <Text className="mt-3 text-lg leading-7 font-bold text-black">
                Private, offline progress. No leaderboards or social comparison.
              </Text>
            </View>
            <Text
              accessibilityLiveRegion="polite"
              className="bg-mapache-vivid-secondary-green border-4 border-black p-4 text-xl font-black text-black uppercase"
            >
              {unlockedCount} of {achievements.length} unlocked
            </Text>
          </View>
        }
        renderItem={({ item }) => <NativeAchievementCard achievement={item} />}
      />
    </MapacheScreen>
  )
}

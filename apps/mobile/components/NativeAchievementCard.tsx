import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import { View } from "react-native"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

export default function NativeAchievementCard({
  achievement,
}: {
  readonly achievement: AchievementPresentation
}) {
  const isUnlocked = achievement.status === "unlocked"

  return (
    <View
      className={cn(
        "min-w-0 border-4 border-black p-4 shadow-[5px_5px_0px_0px_#000000]",
        isUnlocked ? "bg-mapache-vivid-secondary-gold" : "bg-white",
      )}
    >
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <Text
          accessibilityRole="header"
          className="min-w-0 flex-1 text-2xl font-black text-black uppercase"
        >
          {achievement.title}
        </Text>
        <Text className="shrink-0 border-4 border-black bg-black px-3 py-1 text-sm font-black text-white uppercase">
          {isUnlocked ? "Unlocked" : "Not unlocked"}
        </Text>
      </View>
      <Text className="mt-3 text-lg leading-7 font-bold text-black">
        {achievement.requirement}
      </Text>
      {achievement.progress ? (
        <View className="mt-4 border-t-4 border-black pt-3">
          <Text className="font-black text-black">
            {achievement.progress.label}
          </Text>
        </View>
      ) : null}
      {achievement.unlockedAt && achievement.unlockedDate ? (
        <Text className="mt-4 border-t-4 border-black pt-3 font-black text-black">
          Unlocked {achievement.unlockedDate}
        </Text>
      ) : null}
    </View>
  )
}

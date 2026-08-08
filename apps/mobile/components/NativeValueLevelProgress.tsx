import { getLevelProgressFromXP } from "@game/utils/src/LevelMath"
import { View } from "react-native"
import { Text } from "@/components/ui/text"

export default function NativeValueLevelProgress({
  totalXp,
}: {
  totalXp: number
}) {
  const { level, earnedXpTowardNextLevel, requiredXpForNextLevel } =
    getLevelProgressFromXP(totalXp)

  return (
    <View className="mt-3 w-full border-4 border-black bg-white px-3 py-2">
      <View className="flex-row items-baseline justify-between gap-3">
        <Text className="text-mapache-vivid-primary-raspberry text-lg font-black uppercase">
          Level {level}
        </Text>
        <Text className="text-mapache-vivid-primary-raspberry text-sm font-black uppercase">
          {earnedXpTowardNextLevel}/{requiredXpForNextLevel} XP
        </Text>
      </View>
      <View
        accessibilityLabel={`XP toward Level ${level + 1}`}
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: requiredXpForNextLevel,
          now: earnedXpTowardNextLevel,
        }}
        className="mt-2 h-3 flex-row overflow-hidden border-2 border-black bg-white"
      >
        <View
          className="bg-mapache-vivid-primary-raspberry"
          style={{ flex: earnedXpTowardNextLevel }}
        />
        <View
          style={{
            flex: requiredXpForNextLevel - earnedXpTowardNextLevel,
          }}
        />
      </View>
    </View>
  )
}

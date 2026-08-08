import { getValueDisplayName } from "@game/data/src/Value"
import type { RankedValue } from "@game/data/src/ValueRanking"
import { Pressable, View } from "react-native"
import NativeValueLevelProgress from "@/components/NativeValueLevelProgress"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

export default function NativeHubValueRow({
  rankedValue,
  showRank,
  isTopFive,
  onOpen,
}: {
  rankedValue: RankedValue
  showRank: boolean
  isTopFive: boolean
  onOpen: () => void
}) {
  const { definition, progress, rank } = rankedValue
  const displayName = getValueDisplayName(definition)

  return (
    <Pressable
      accessibilityHint="Opens the complete value definition without changing your ranking."
      accessibilityLabel={`Open ${displayName} in All Values`}
      accessibilityRole="button"
      className={cn(
        "mb-4 border-4 border-black p-4 shadow-[5px_5px_0px_0px_#000000] active:translate-x-[5px] active:translate-y-[5px] active:shadow-none",
        isTopFive ? "bg-mapache-vivid-secondary-gold" : "bg-white",
      )}
      onPress={onOpen}
    >
      <View className="flex-row items-center gap-3">
        {showRank ? (
          <Text className="bg-mapache-vivid-secondary-purple border-4 border-black px-3 py-2 text-xl font-black text-white uppercase">
            #{rank}
          </Text>
        ) : null}
        <Text
          className={cn(
            "min-w-0 flex-1 text-2xl font-black uppercase",
            isTopFive ? "text-white" : "text-black",
          )}
        >
          {displayName}
        </Text>
      </View>
      <NativeValueLevelProgress totalXp={progress.totalXp} />
    </Pressable>
  )
}

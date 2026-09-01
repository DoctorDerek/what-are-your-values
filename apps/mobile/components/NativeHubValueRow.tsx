import {
  SEETHING_SWARM_HUB_TILE_SIZE,
  type ValueAnimalPresentation,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
import { getValueDisplayName } from "@game/data/src/Value"
import type { RankedValue } from "@game/data/src/ValueRanking"
import { Pressable, View } from "react-native"
import NativeSeethingSwarmAnimal from "@/components/NativeSeethingSwarmAnimal"
import NativeValueLevelProgress from "@/components/NativeValueLevelProgress"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

function NativeValueRankPresentation({
  rank,
  valuePresentation,
  shouldReduceMotion,
}: {
  rank: number
  valuePresentation: ValueAnimalPresentation<number> | undefined
  shouldReduceMotion: boolean
}) {
  if (!valuePresentation || valuePresentation.kind === "typography-only")
    return (
      <Text className="bg-mapache-vivid-secondary-purple border-4 border-black px-3 py-2 text-xl font-black text-white uppercase">
        #{rank}
      </Text>
    )

  return (
    <View
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      className="relative flex-none items-center justify-center overflow-hidden bg-white"
      style={{
        width: SEETHING_SWARM_HUB_TILE_SIZE,
        height: SEETHING_SWARM_HUB_TILE_SIZE,
      }}
      testID={`hub-top-five-rank-${rank}-presentation`}
    >
      {valuePresentation.kind === "animal" ? (
        <NativeSeethingSwarmAnimal
          presentation={valuePresentation.animal}
          shouldReduceMotion={shouldReduceMotion}
        />
      ) : (
        <Text className="text-mapache-vivid-secondary-purple text-4xl font-black uppercase">
          {valuePresentation.initial}
        </Text>
      )}
      <Text className="bg-mapache-vivid-secondary-purple absolute top-0 left-0 z-10 border-r-4 border-b-4 border-black px-1.5 py-1 text-sm leading-none font-black text-white uppercase">
        #{rank}
      </Text>
    </View>
  )
}

export default function NativeHubValueRow({
  rankedValue,
  showRank,
  isTopFive,
  valuePresentation,
  shouldReduceMotion,
  onOpen,
}: {
  rankedValue: RankedValue
  showRank: boolean
  isTopFive: boolean
  valuePresentation?: ValueAnimalPresentation<number>
  shouldReduceMotion: boolean
  onOpen: () => void
}) {
  const { definition, progress, rank } = rankedValue
  const displayName = getValueDisplayName(definition)

  return (
    <Pressable
      accessibilityHint="Opens the complete value definition without changing your ranking."
      accessibilityLabel={
        showRank
          ? `Rank ${rank}. Open ${displayName} in All Values`
          : `Open ${displayName} in All Values`
      }
      accessibilityRole="button"
      className={cn(
        "mb-4 border-4 border-black p-4 shadow-[5px_5px_0px_0px_#000000] active:translate-x-[5px] active:translate-y-[5px] active:shadow-none",
        isTopFive ? "bg-mapache-vivid-secondary-gold" : "bg-white",
      )}
      onPress={onOpen}
    >
      <View className="flex-row items-center gap-3">
        {showRank ? (
          <NativeValueRankPresentation
            rank={rank}
            valuePresentation={valuePresentation}
            shouldReduceMotion={shouldReduceMotion}
          />
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

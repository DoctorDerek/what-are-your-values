import {
  getValueDisplayDefinition,
  getValueDisplayName,
} from "@game/data/src/Value"
import type { RankedValue } from "@game/data/src/ValueRanking"
import { View } from "react-native"
import NativeValueLevelProgress from "@/components/NativeValueLevelProgress"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

export default function NativeValueDetailsCard({
  isHighlighted,
  isPersistencePending,
  onDelete,
  onEdit,
  rankedValue,
  showRank,
}: {
  readonly isHighlighted: boolean
  readonly isPersistencePending: boolean
  readonly onDelete: () => void
  readonly onEdit: () => void
  readonly rankedValue: RankedValue
  readonly showRank: boolean
}) {
  const { definition, progress, rank } = rankedValue
  const displayName = getValueDisplayName(definition)

  return (
    <View
      accessibilityLabel={`${displayName} details`}
      className={cn(
        "border-4 border-black bg-white p-4 shadow-[5px_5px_0px_0px_#000000]",
        isHighlighted ? "border-mapache-vivid-primary-cyan border-8" : null,
      )}
    >
      <View className="flex-row flex-wrap items-center gap-2">
        {showRank ? (
          <Text
            accessibilityLabel={`Rank ${rank}`}
            className="bg-mapache-vivid-secondary-purple border-2 border-black px-2 py-1 text-xl font-black text-white"
          >
            #{rank}
          </Text>
        ) : null}
        <Text
          accessibilityRole="header"
          className="min-w-0 flex-1 text-2xl font-black text-black uppercase"
        >
          {displayName}
        </Text>
        {definition.kind === "custom" ? (
          <Text className="bg-mapache-vivid-primary-cyan border-2 border-black px-2 py-1 text-sm font-black text-black uppercase">
            Yours
          </Text>
        ) : null}
      </View>
      <NativeValueLevelProgress totalXp={progress.totalXp} />
      <Text className="mt-4 border-t-4 border-black pt-4 text-lg leading-7 font-bold text-black">
        “{getValueDisplayDefinition(definition)}”
      </Text>
      {definition.kind === "custom" ? (
        <View className="mt-4 flex-row gap-3">
          <Button
            className="min-w-0 flex-1"
            disabled={isPersistencePending}
            variant="secondary"
            onPress={onEdit}
          >
            <Text>Edit</Text>
          </Button>
          <Button
            className="min-w-0 flex-1"
            disabled={isPersistencePending}
            variant="destructive"
            onPress={onDelete}
          >
            <Text>Delete</Text>
          </Button>
        </View>
      ) : null}
    </View>
  )
}

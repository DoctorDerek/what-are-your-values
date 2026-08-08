import {
  PLAYER_DATA_RESET_KINDS,
  type PlayerDataResetKind,
} from "@game/machines/src/PlayerDataReset"
import { playerDataResetCopy } from "@game/machines/src/PlayerDataResetCopy"
import { View } from "react-native"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

export default function NativePlayerDataResetActions({
  customValueCount,
  isBusy,
  onRequestReset,
}: {
  readonly customValueCount: number
  readonly isBusy: boolean
  readonly onRequestReset: (resetKind: PlayerDataResetKind) => void
}) {
  return (
    <View className="gap-5">
      <Text
        variant="h2"
        className="text-mapache-vivid-primary-cyan border-b-4 border-black text-left text-3xl uppercase"
      >
        Reset or Delete
      </Text>

      {PLAYER_DATA_RESET_KINDS.map((resetKind) => {
        const copy = playerDataResetCopy[resetKind]
        const hasNothingToDelete =
          resetKind === "delete-all-custom-values" && customValueCount === 0
        const isCompleteErasure = resetKind === "delete-all-data"

        return (
          <View
            key={resetKind}
            className={cn(
              "gap-4 border-4 bg-white p-5 shadow-[6px_6px_0px_0px_#000000]",
              isCompleteErasure
                ? "border-mapache-vivid-secondary-red"
                : "border-black",
            )}
          >
            <Text
              accessibilityRole="header"
              className="border-b-4 border-black pb-3 text-2xl font-black text-black uppercase"
            >
              {copy.actionLabel}
            </Text>
            <Text className="text-lg leading-7 font-bold text-black">
              {copy.summary}
            </Text>
            {hasNothingToDelete ? (
              <Text className="text-base font-black text-black">
                No Custom Values to delete.
              </Text>
            ) : null}
            <Button
              disabled={isBusy || hasNothingToDelete}
              variant={isCompleteErasure ? "destructive" : "outline"}
              onPress={() => onRequestReset(resetKind)}
            >
              <Text>{copy.actionLabel}</Text>
            </Button>
          </View>
        )
      })}
    </View>
  )
}

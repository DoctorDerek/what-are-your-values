import {
  getValueDisplayDefinition,
  getValueDisplayName,
  type ActiveValueDefinition,
  type ValueId,
} from "@game/data/src/Value"
import { getValueChoiceAccessibilityLabel } from "@game/machines/src/BattleAccessibilityPresentation"
import { forwardRef, type ForwardedRef, type ReactNode } from "react"
import { Pressable, ScrollView, View } from "react-native"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

type NativeValueChoiceCardProps = {
  position: "first" | "second"
  value: ActiveValueDefinition
  level: number
  controlHint: string | null
  winnerId: ValueId | null
  isEnabled: boolean
  isAnimating: boolean
  combatant?: ReactNode
  onActivate: (valueId: ValueId) => void
}

function NativeValueChoiceCard(
  {
    position,
    value,
    level,
    controlHint,
    winnerId,
    isEnabled,
    isAnimating,
    combatant,
    onActivate,
  }: NativeValueChoiceCardProps,
  ref: ForwardedRef<View>,
) {
  const isWinner = isAnimating && winnerId === value.id

  const displayName = getValueDisplayName(value)
  const displayDefinition = getValueDisplayDefinition(value)

  return (
    <View
      className={cn(
        "min-h-0 flex-1 border-4 border-black",
        isWinner && "z-10 border-white",
        position === "first"
          ? "bg-mapache-vivid-primary-cyan"
          : "bg-mapache-vivid-primary-raspberry",
      )}
    >
        <Pressable
          ref={ref}
          accessibilityHint={displayDefinition}
          accessibilityLabel={getValueChoiceAccessibilityLabel({
            position,
            value,
            level,
          })}
          accessibilityRole="button"
          accessibilityState={{ disabled: !isEnabled, selected: isWinner }}
          className="min-h-0 flex-1 flex-row items-center xl:flex-col"
          disabled={!isEnabled}
          onPress={() => onActivate(value.id)}
        >
          <ScrollView className="h-full min-h-0 min-w-0 flex-1 xl:h-auto xl:w-full" contentContainerClassName="grow justify-center px-3 py-3 xl:px-6 xl:py-8" nestedScrollEnabled>
          <View className="w-full items-center">
            <Text
              variant="h2"
              className="w-full min-w-0 border-0 pb-0 text-center text-2xl leading-8 text-white uppercase xl:text-5xl xl:leading-[56px]"
              lineBreakStrategyIOS="push-out"
              textBreakStrategy="balanced"
            >
              {displayName}
            </Text>
            <View className="mt-2 w-full min-w-0 flex-row items-center justify-between gap-2 xl:gap-5">
              <Text
                aria-hidden
                className={cn(
                  "w-12 shrink-0 text-center text-sm font-black text-black/50 uppercase xl:w-24 xl:text-xl",
                  !controlHint && "opacity-0",
                )}
              >
                {controlHint}
              </Text>
              <Text className="shrink-0 border-2 border-black bg-white px-2 py-1 text-sm font-black text-black uppercase shadow-[3px_3px_0px_0px_#000000] xl:border-4 xl:px-4 xl:py-2 xl:text-2xl xl:shadow-[5px_5px_0px_0px_#000000]">
                LVL {level}
              </Text>
            </View>
            <Text className="mt-3 w-full border-2 border-white bg-black/50 p-3 text-center text-lg leading-7 font-bold text-white xl:mt-6 xl:p-5 xl:text-xl xl:leading-8">
              “{displayDefinition}”
            </Text>
          </View>
          </ScrollView>
          {combatant ? <View className={cn("h-full w-1/3 min-w-28 max-w-56 shrink-0 flex-row items-center xl:h-28 xl:w-28", position === "first" ? "justify-start xl:self-end" : "justify-end xl:self-start")}>{combatant}</View> : null}
        </Pressable>
    </View>
  )
}

export default forwardRef(NativeValueChoiceCard)

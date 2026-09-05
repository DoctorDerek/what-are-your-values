import {
  getValueDisplayDefinition,
  getValueDisplayName,
  type ActiveValueDefinition,
  type ValueId,
} from "@game/data/src/Value"
import { getValueChoiceAccessibilityLabel } from "@game/machines/src/BattleAccessibilityPresentation"
import { forwardRef, useEffect, type ForwardedRef } from "react"
import { Pressable, ScrollView, View } from "react-native"
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { Text } from "@/components/ui/text"
import {
  createNativeValueChoiceMotion,
  type NativeValueChoicePosition,
} from "@/lib/NativeValueChoiceMotion"
import { cn } from "@/lib/utils"

type NativeValueChoiceCardProps = {
  position: NativeValueChoicePosition
  value: ActiveValueDefinition
  level: number
  controlHint: string | null
  winnerId: ValueId | null
  isEnabled: boolean
  isAnimating: boolean
  shouldReduceMotion: boolean
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
    shouldReduceMotion,
    onActivate,
  }: NativeValueChoiceCardProps,
  ref: ForwardedRef<View>,
) {
  const isWinner = isAnimating && winnerId === value.id
  const isDefeated = isAnimating && winnerId !== null && winnerId !== value.id
  const opacity = useSharedValue(1)
  const scale = useSharedValue(1)
  const translateY = useSharedValue(0)
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }))

  useEffect(() => {
    const motion = createNativeValueChoiceMotion({
      position,
      isWinner,
      isDefeated,
      shouldReduceMotion,
    })
    const timing = {
      duration: motion.durationMilliseconds,
      reduceMotion: ReduceMotion.Never,
    }

    cancelAnimation(opacity)
    cancelAnimation(scale)
    cancelAnimation(translateY)

    if (motion.durationMilliseconds === 0) {
      opacity.set(motion.opacity)
      scale.set(motion.scale)
      translateY.set(motion.translateY)
      return
    }

    opacity.set(withTiming(motion.opacity, timing))
    scale.set(withTiming(motion.scale, timing))
    translateY.set(withTiming(motion.translateY, timing))
    return () => {
      cancelAnimation(opacity)
      cancelAnimation(scale)
      cancelAnimation(translateY)
    }
  }, [
    isDefeated,
    isWinner,
    opacity,
    position,
    scale,
    shouldReduceMotion,
    translateY,
  ])

  const displayName = getValueDisplayName(value)
  const displayDefinition = getValueDisplayDefinition(value)

  return (
    <Animated.View
      className={cn(
        "min-h-0 flex-1 overflow-hidden border-4 border-black",
        position === "first"
          ? "bg-mapache-vivid-primary-cyan"
          : "bg-mapache-vivid-primary-raspberry",
      )}
      style={animatedStyle}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow"
        nestedScrollEnabled
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
          className="min-h-full flex-1 items-center justify-center px-3 py-4 xl:px-6 xl:py-8"
          disabled={!isEnabled}
          onPress={() => onActivate(value.id)}
        >
          <View className="w-full items-center">
            <View className="w-full min-w-0 flex-row items-center gap-2 xl:gap-5">
              <Text
                aria-hidden
                className={cn(
                  "w-12 shrink-0 text-center text-sm font-black text-black/50 uppercase xl:w-24 xl:text-xl",
                  !controlHint && "opacity-0",
                )}
              >
                {controlHint}
              </Text>
              <Text
                variant="h2"
                className="min-w-0 flex-1 border-0 pb-0 text-center text-2xl leading-8 text-white uppercase xl:text-5xl xl:leading-[56px]"
                lineBreakStrategyIOS="push-out"
                textBreakStrategy="balanced"
              >
                {displayName}
              </Text>
              <Text className="shrink-0 border-2 border-black bg-white px-2 py-1 text-sm font-black text-black uppercase shadow-[3px_3px_0px_0px_#000000] xl:border-4 xl:px-4 xl:py-2 xl:text-2xl xl:shadow-[5px_5px_0px_0px_#000000]">
                LVL {level}
              </Text>
            </View>
            <Text className="mt-3 w-full border-2 border-white bg-black/50 p-3 text-center text-lg leading-7 font-bold text-white xl:mt-6 xl:p-5 xl:text-xl xl:leading-8">
              “{displayDefinition}”
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </Animated.View>
  )
}

export default forwardRef(NativeValueChoiceCard)

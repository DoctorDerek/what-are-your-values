import {
  getValueDisplayDefinition,
  getValueDisplayName,
  type ActiveValueDefinition,
  type ValueId,
} from "@game/data/src/Value"
import { useEffect } from "react"
import { Pressable, ScrollView, View } from "react-native"
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { Text } from "@/components/ui/text"
import {
  createNativeValueChoiceMotion,
  type NativeValueChoicePosition,
} from "@/lib/NativeValueChoiceMotion"
import { cn } from "@/lib/utils"

export default function NativeValueChoiceCard({
  position,
  value,
  level,
  winnerId,
  isEnabled,
  isAnimating,
  reportsAnimationCompletion,
  shouldReduceMotion,
  onActivate,
  onAnimationComplete,
}: {
  position: NativeValueChoicePosition
  value: ActiveValueDefinition
  level: number
  winnerId: ValueId | null
  isEnabled: boolean
  isAnimating: boolean
  reportsAnimationCompletion: boolean
  shouldReduceMotion: boolean
  onActivate: (valueId: ValueId) => void
  onAnimationComplete: () => void
}) {
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
    const timing = { duration: motion.durationMilliseconds }

    cancelAnimation(opacity)
    cancelAnimation(scale)
    cancelAnimation(translateY)

    if (motion.durationMilliseconds === 0) {
      opacity.set(motion.opacity)
      scale.set(motion.scale)
      translateY.set(motion.translateY)
      if (isAnimating && reportsAnimationCompletion) onAnimationComplete()
      return
    }

    opacity.set(withTiming(motion.opacity, timing))
    scale.set(withTiming(motion.scale, timing))
    translateY.set(
      withTiming(motion.translateY, timing, (finished) => {
        if (finished && isAnimating && reportsAnimationCompletion)
          scheduleOnRN(onAnimationComplete)
      }),
    )
  }, [
    isAnimating,
    isDefeated,
    isWinner,
    onAnimationComplete,
    opacity,
    position,
    reportsAnimationCompletion,
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
          accessibilityHint={displayDefinition}
          accessibilityLabel={`Choose ${displayName}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: !isEnabled, selected: isWinner }}
          className="min-h-full flex-1 items-center justify-center px-3 py-4 xl:px-6 xl:py-8"
          disabled={!isEnabled}
          onPress={() => onActivate(value.id)}
        >
          <View className="w-full items-center">
            <View className="w-full min-w-0 flex-row items-center gap-3 xl:gap-5">
              <Text
                variant="h2"
                className="min-w-0 flex-1 border-0 pb-0 text-center text-3xl leading-9 text-white uppercase xl:text-5xl xl:leading-[56px]"
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

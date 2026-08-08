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
  useReducedMotion,
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
  onActivate: (valueId: ValueId) => void
  onAnimationComplete: () => void
}) {
  const shouldReduceMotion = useReducedMotion()
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
          className="min-h-full flex-1 items-center justify-center px-5 py-7"
          disabled={!isEnabled}
          onPress={() => onActivate(value.id)}
        >
          <View className="w-full items-center">
            <Text className="mb-5 border-4 border-black bg-white px-4 py-2 text-xl font-black text-black uppercase shadow-[5px_5px_0px_0px_#000000]">
              Level {level}
            </Text>
            <Text
              variant="h2"
              className="border-0 pb-0 text-center text-4xl leading-[48px] text-white uppercase"
            >
              {displayName}
            </Text>
            <Text className="mt-6 w-full border-2 border-white bg-black/50 p-5 text-center text-xl leading-8 font-bold text-white">
              “{displayDefinition}”
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </Animated.View>
  )
}

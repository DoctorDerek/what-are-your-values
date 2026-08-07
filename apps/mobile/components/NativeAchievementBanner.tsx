import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import { useEffect } from "react"
import { View } from "react-native"
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { scheduleOnRN } from "react-native-worklets"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

const ACHIEVEMENT_BANNER_DURATION_MILLISECONDS = 8_000

export default function NativeAchievementBanner({
  achievement,
  isAcknowledgementPending,
  onPresented,
}: {
  achievement: AchievementPresentation | null
  isAcknowledgementPending: boolean
  onPresented: (achievementId: AchievementPresentation["id"]) => void
}) {
  const shouldReduceMotion = useReducedMotion()
  const safeAreaInsets = useSafeAreaInsets()
  const presentationProgress = useSharedValue(0)
  const animatedStyle = useAnimatedStyle(() => {
    const progress = presentationProgress.get()

    return {
      opacity: shouldReduceMotion
        ? 1
        : interpolate(progress, [0, 0.08, 1], [0, 1, 1]),
      transform: [
        {
          translateY: shouldReduceMotion
            ? 0
            : interpolate(progress, [0, 0.08, 1], [24, 0, 0]),
        },
      ],
    }
  })

  useEffect(() => {
    cancelAnimation(presentationProgress)
    presentationProgress.set(0)
    if (!achievement || isAcknowledgementPending) return

    presentationProgress.set(
      withTiming(
        1,
        { duration: ACHIEVEMENT_BANNER_DURATION_MILLISECONDS },
        (finished) => {
          if (finished) scheduleOnRN(onPresented, achievement.id)
        },
      ),
    )

    return () => cancelAnimation(presentationProgress)
  }, [achievement, isAcknowledgementPending, onPresented, presentationProgress])

  if (!achievement) return null

  return (
    <Animated.View
      accessibilityLabel={`Achievement unlocked: ${achievement.title}`}
      accessibilityLiveRegion="polite"
      className="bg-mapache-vivid-secondary-gold absolute right-3 left-3 z-50 max-h-56 border-4 border-black p-4 shadow-[7px_7px_0px_0px_#000000]"
      style={[animatedStyle, { bottom: safeAreaInsets.bottom + 12 }]}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-black text-white uppercase">
            Achievement Unlocked
          </Text>
          <Text
            variant="h2"
            className="mt-1 border-0 pb-0 text-left text-2xl text-white uppercase"
          >
            {achievement.title}
          </Text>
        </View>
        <Button
          accessibilityLabel="Dismiss achievement"
          disabled={isAcknowledgementPending}
          size="compact"
          variant="outline"
          onPress={() => onPresented(achievement.id)}
        >
          <Text>×</Text>
        </Button>
      </View>
      <Text className="mt-3 text-base font-bold text-white">
        {achievement.requirement}
      </Text>
    </Animated.View>
  )
}

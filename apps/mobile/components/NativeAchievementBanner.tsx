import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import { useEffect } from "react"
import { useWindowDimensions, View } from "react-native"
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
import { cn } from "@/lib/utils"

const ACHIEVEMENT_BANNER_DURATION_MILLISECONDS = 8_000

export default function NativeAchievementBanner({
  achievement,
  isAcknowledgementPending,
  placement = "screen",
  onPresented,
}: {
  achievement: AchievementPresentation | null
  isAcknowledgementPending: boolean
  placement?: "battle" | "screen"
  onPresented: (achievementId: AchievementPresentation["id"]) => void
}) {
  const shouldReduceMotion = useReducedMotion()
  const safeAreaInsets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const isBattlePlacement = placement === "battle"
  const isBattleLandscape = isBattlePlacement && width > height
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
      className={cn(
        "bg-mapache-vivid-secondary-gold z-50 max-h-56 border-4 border-black p-4 shadow-[7px_7px_0px_0px_#000000]",
        isBattlePlacement
          ? "absolute top-0 right-3 left-3"
          : "absolute right-3 left-3",
        isBattleLandscape && "flex-row items-center gap-4",
      )}
      style={
        isBattlePlacement
          ? animatedStyle
          : [animatedStyle, { bottom: safeAreaInsets.bottom + 12 }]
      }
    >
      <View
        className={cn(
          "flex-row items-start justify-between gap-3",
          isBattleLandscape && "min-w-0 flex-1",
        )}
      >
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
      <Text
        className={cn(
          "mt-3 text-base font-bold text-white",
          isBattleLandscape && "mt-0 min-w-0 flex-1",
        )}
      >
        {achievement.requirement}
      </Text>
    </Animated.View>
  )
}

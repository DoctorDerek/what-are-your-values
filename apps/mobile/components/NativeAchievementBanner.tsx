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
  const isBattlePlacement = placement === "battle"
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
        "bg-mapache-vivid-white z-50 max-h-48 border-4 border-black p-3 shadow-[7px_7px_0px_0px_#000000] xl:max-h-56 xl:p-4",
        isBattlePlacement
          ? "mx-3 mb-3 shrink-0 xl:flex-row xl:items-center xl:gap-4"
          : "absolute right-3 left-3",
      )}
      style={
        isBattlePlacement
          ? animatedStyle
          : [animatedStyle, { bottom: safeAreaInsets.bottom + 12 }]
      }
    >
      <View
        className={cn(
          "min-w-0 pr-16",
          isBattlePlacement && "xl:flex-1 xl:pr-0",
        )}
      >
        <Text className="text-mapache-vivid-black text-sm font-black uppercase">
          Achievement Unlocked
        </Text>
        <Text
          variant="h2"
          className="text-mapache-vivid-black mt-1 border-0 pb-0 text-left text-2xl uppercase"
        >
          {achievement.title}
        </Text>
      </View>
      <Text
        className={cn(
          "text-mapache-vivid-black mt-3 text-base font-bold",
          isBattlePlacement && "xl:mt-0 xl:min-w-0 xl:flex-1 xl:pr-16",
        )}
      >
        {achievement.requirement}
      </Text>
      <Button
        accessibilityLabel="Dismiss achievement"
        className="absolute top-4 right-4 z-10"
        disabled={isAcknowledgementPending}
        size="compact"
        variant="outline"
        onPress={() => onPresented(achievement.id)}
      >
        <Text>×</Text>
      </Button>
    </Animated.View>
  )
}

import { SEETHING_SWARM_BATTLE_RESULT_DURATION_MS } from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { SeethingSwarmBattleCombatantSide } from "@game/machines/src/SeethingSwarmBattleChoreography"
import { useEffect, useRef } from "react"
import { View } from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"
import { cn } from "@/lib/utils"

export default function NativeSeethingSwarmPlaceholder({
  side,
  role,
  shouldReduceMotion,
  onPlaybackComplete,
  onReady,
}: {
  side: SeethingSwarmBattleCombatantSide
  role: "rest" | "attack" | "reaction" | "flourish"
  shouldReduceMotion: boolean
  onPlaybackComplete: () => void
  onReady?: () => void
}) {
  const progress = useSharedValue(0)
  const playbackCompleteRef = useRef(onPlaybackComplete)
  useEffect(() => {
    playbackCompleteRef.current = onPlaybackComplete
  }, [onPlaybackComplete])
  useEffect(() => onReady?.(), [onReady])
  const direction = side === "first" ? 1 : -1
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: role === "reaction" ? progress.get() * direction * -12 : 0,
      },
      {
        translateY:
          role === "rest" || role === "flourish" ? progress.get() * -4 : 0,
      },
      {
        rotate: `${role === "reaction" ? progress.get() * direction * -10 : 0}deg`,
      },
    ],
  }))

  useEffect(() => {
    let isActive = true
    const finishPlayback = () => {
      if (isActive) playbackCompleteRef.current()
    }
    cancelAnimation(progress)
    progress.set(0)
    if (shouldReduceMotion) {
      if (role !== "rest") finishPlayback()
      return
    }
    const timing = {
      duration: SEETHING_SWARM_BATTLE_RESULT_DURATION_MS / 2,
      easing: Easing.inOut(Easing.quad),
      reduceMotion: ReduceMotion.Never,
    }
    if (role === "rest") {
      progress.set(
        withRepeat(
          withTiming(1, timing),
          -1,
          true,
          undefined,
          ReduceMotion.Never,
        ),
      )
    } else {
      progress.set(
        withSequence(
          ReduceMotion.Never,
          withTiming(1, timing),
          withTiming(role === "reaction" ? 1 : 0, timing, (finished) => {
            if (finished) scheduleOnRN(finishPlayback)
          }),
        ),
      )
    }
    return () => {
      isActive = false
      cancelAnimation(progress)
    }
  }, [progress, role, shouldReduceMotion])

  return (
    <View className="h-28 w-28 shrink-0 items-center justify-end">
      <Animated.View
        testID={`battle-placeholder-${side}`}
        style={animatedStyle}
        className="h-24 w-20"
      >
        <View
          className={cn(
            "absolute top-0 left-1 h-7 w-6 border-4 border-black",
            side === "first"
              ? "bg-mapache-vivid-primary-cyan"
              : "bg-mapache-vivid-primary-raspberry",
          )}
        />
        <View
          className={cn(
            "absolute top-0 right-1 h-7 w-6 border-4 border-black",
            side === "first"
              ? "bg-mapache-vivid-primary-cyan"
              : "bg-mapache-vivid-primary-raspberry",
          )}
        />
        <View
          className={cn(
            "absolute right-0 bottom-0 left-0 h-20 items-center border-4 border-black",
            side === "first"
              ? "bg-mapache-vivid-primary-cyan"
              : "bg-mapache-vivid-primary-raspberry",
          )}
        >
          <View className="mt-4 flex-row gap-4">
            <View className="h-3 w-3 bg-black" />
            <View className="h-3 w-3 bg-black" />
          </View>
          <View className="mt-2 h-3 w-5 bg-black" />
        </View>
      </Animated.View>
    </View>
  )
}

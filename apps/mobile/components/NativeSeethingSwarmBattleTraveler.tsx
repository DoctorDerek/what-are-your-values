import {
  SEETHING_SWARM_BATTLE_APPROACH_DURATION_MS,
  type SeethingSwarmBattleExchangeCue,
  type SeethingSwarmBattlePoint,
} from "@game/machines/src/SeethingSwarmBattleExchange"
import { useEffect, useRef, type ReactNode } from "react"
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { scheduleOnRN } from "react-native-worklets"

export default function NativeSeethingSwarmBattleTraveler({
  cue,
  travel,
  shouldReduceMotion,
  onApproachComplete,
  children,
}: {
  cue: SeethingSwarmBattleExchangeCue
  travel: SeethingSwarmBattlePoint | null
  shouldReduceMotion: boolean
  onApproachComplete: () => void
  children: ReactNode
}) {
  const progress = useSharedValue(0)
  const completeRef = useRef(onApproachComplete)
  useEffect(() => {
    completeRef.current = onApproachComplete
  }, [onApproachComplete])
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: progress.get() * (travel?.x ?? 0) },
      { translateY: progress.get() * (travel?.y ?? 0) },
    ],
  }))

  useEffect(() => {
    let isActive = true
    const finishApproach = () => {
      if (isActive && cue === "approach") completeRef.current()
    }
    cancelAnimation(progress)
    if (!travel || shouldReduceMotion) {
      progress.set(0)
      return
    }
    progress.set(
      withTiming(
        1,
        {
          duration: SEETHING_SWARM_BATTLE_APPROACH_DURATION_MS,
          easing: Easing.out(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        },
        (finished) => {
          if (finished) scheduleOnRN(finishApproach)
        },
      ),
    )
    return () => {
      isActive = false
      cancelAnimation(progress)
    }
  }, [cue, progress, shouldReduceMotion, travel])

  return (
    <Animated.View
      className="size-28 items-center justify-end xl:size-56"
      style={animatedStyle}
    >
      {children}
    </Animated.View>
  )
}

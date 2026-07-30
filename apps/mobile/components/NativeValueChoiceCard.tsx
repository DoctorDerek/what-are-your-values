import {
  getValueDisplayDefinition,
  getValueDisplayName,
  type ActiveValueDefinition,
  type ValueId,
} from "@game/data/src/Value"
import { useEffect } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

const RESULT_ANIMATION_DURATION_MS = 240

export default function NativeValueChoiceCard({
  completionOwner,
  isAnimating,
  isEnabled,
  level,
  onActivate,
  onResultAnimationComplete,
  position,
  value,
  winnerId,
}: {
  readonly completionOwner: boolean
  readonly isAnimating: boolean
  readonly isEnabled: boolean
  readonly level: number
  readonly onActivate: (valueId: ValueId) => void
  readonly onResultAnimationComplete: () => void
  readonly position: "first" | "second"
  readonly value: ActiveValueDefinition
  readonly winnerId: ValueId | null
}) {
  const displayName = getValueDisplayName(value)
  const displayDefinition = getValueDisplayDefinition(value)
  const shouldReduceMotion = useReducedMotion()
  const resultProgress = useSharedValue(0)
  const isWinner = isAnimating && winnerId === value.id

  useEffect(() => {
    if (!isAnimating) {
      resultProgress.value = 0
      return
    }

    if (shouldReduceMotion) {
      if (completionOwner) {
        onResultAnimationComplete()
      }
      return
    }

    resultProgress.value = withTiming(
      1,
      { duration: RESULT_ANIMATION_DURATION_MS },
      (finished) => {
        if (finished && completionOwner) {
          runOnJS(onResultAnimationComplete)()
        }
      },
    )
  }, [
    completionOwner,
    isAnimating,
    onResultAnimationComplete,
    resultProgress,
    shouldReduceMotion,
  ])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: isWinner ? 1 : 1 - resultProgress.value * 0.35,
    transform: [
      {
        scale: isWinner
          ? 1 + resultProgress.value * 0.04
          : 1 - resultProgress.value * 0.04,
      },
    ],
  }))

  return (
    <Animated.View
      style={[
        styles.card,
        position === "first" ? styles.firstCard : styles.secondCard,
        animatedStyle,
      ]}
    >
      <Pressable
        accessibilityHint="Commits this value as the winner of the current battle."
        accessibilityLabel={`Choose ${displayName}. Level ${level}. ${displayDefinition}`}
        accessibilityRole="button"
        accessibilityState={{
          disabled: !isEnabled,
          selected: isWinner,
        }}
        disabled={!isEnabled}
        onPress={() => onActivate(value.id)}
        style={({ pressed }) => [
          styles.choice,
          pressed && isEnabled ? styles.pressed : null,
        ]}
      >
        <View style={styles.levelBadge}>
          <Text style={styles.level}>Level {level}</Text>
        </View>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.definition}>“{displayDefinition}”</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    flexGrow: 1,
    minHeight: 280,
  },
  choice: {
    alignItems: "center",
    flex: 1,
    gap: mapacheSpacing.spacious,
    justifyContent: "center",
    padding: mapacheSpacing.spacious,
  },
  definition: {
    backgroundColor: mapacheColors.charcoal,
    borderColor: mapacheColors.white,
    borderWidth: 2,
    color: mapacheColors.white,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 29,
    padding: mapacheSpacing.standard,
    textAlign: "center",
  },
  firstCard: {
    backgroundColor: mapacheColors.cyan,
  },
  level: {
    color: mapacheColors.black,
    fontSize: 18,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  levelBadge: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    paddingHorizontal: mapacheSpacing.standard,
    paddingVertical: mapacheSpacing.compact,
  },
  name: {
    color: mapacheColors.white,
    fontSize: 38,
    fontWeight: "900",
    lineHeight: 43,
    textAlign: "center",
    textTransform: "uppercase",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  secondCard: {
    backgroundColor: mapacheColors.raspberry,
  },
})

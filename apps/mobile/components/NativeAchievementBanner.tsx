import { getAchievementDefinition } from "@game/machines/src/AchievementCatalog"
import type { AchievementUnlock } from "@game/machines/src/AchievementState"
import { useEffect } from "react"
import { StyleSheet, Text, View } from "react-native"
import Animated, {
  cancelAnimation,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import MapacheButton from "@/components/MapacheButton"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

const ACHIEVEMENT_BANNER_DURATION_MS = 8_000

export default function NativeAchievementBanner({
  isPresentationPersistencePending,
  onPresented,
  unlock,
}: {
  readonly isPresentationPersistencePending: boolean
  readonly onPresented: (achievementId: AchievementUnlock["id"]) => void
  readonly unlock: AchievementUnlock | null
}) {
  const shouldReduceMotion = useReducedMotion()
  const presentationProgress = useSharedValue(0)

  useEffect(() => {
    if (!unlock) {
      presentationProgress.value = 0
      return
    }

    presentationProgress.value = 0
    presentationProgress.value = withTiming(
      1,
      {
        duration: ACHIEVEMENT_BANNER_DURATION_MS,
        reduceMotion: ReduceMotion.Never,
      },
      (finished) => {
        if (finished) {
          runOnJS(onPresented)(unlock.id)
        }
      },
    )

    return () => cancelAnimation(presentationProgress)
  }, [onPresented, presentationProgress, unlock])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: shouldReduceMotion
      ? 1
      : Math.min(presentationProgress.value * 12.5, 1),
    transform: [
      {
        translateY: shouldReduceMotion
          ? 0
          : Math.max(24 - presentationProgress.value * 300, 0),
      },
    ],
  }))

  if (!unlock) {
    return null
  }

  const achievement = getAchievementDefinition(unlock.id)
  const dismiss = () => {
    cancelAnimation(presentationProgress)
    onPresented(unlock.id)
  }

  return (
    <Animated.View
      accessibilityLabel={`Achievement unlocked: ${achievement.title}`}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.position, animatedStyle]}
    >
      <View style={styles.banner}>
        <View style={styles.heading}>
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>Achievement Unlocked</Text>
            <Text accessibilityRole="header" style={styles.title}>
              {achievement.title}
            </Text>
          </View>
          <MapacheButton
            disabled={isPresentationPersistencePending}
            label="Dismiss"
            onPress={dismiss}
            tone="charcoal"
          />
        </View>
        <Text style={styles.description}>{achievement.description}</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: mapacheColors.gold,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    elevation: mapacheLayout.panelShadowOffset,
    gap: mapacheSpacing.standard,
    padding: mapacheSpacing.standard,
    shadowColor: mapacheColors.black,
    shadowOffset: {
      height: mapacheLayout.panelShadowOffset,
      width: mapacheLayout.panelShadowOffset,
    },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  copy: {
    flex: 1,
  },
  description: {
    color: mapacheColors.charcoal,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 25,
  },
  eyebrow: {
    color: mapacheColors.charcoal,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  heading: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mapacheSpacing.standard,
  },
  position: {
    bottom: mapacheSpacing.standard,
    left: mapacheSpacing.standard,
    position: "absolute",
    right: mapacheSpacing.standard,
    zIndex: 100,
  },
  title: {
    color: mapacheColors.charcoal,
    fontSize: 26,
    fontWeight: "900",
    textTransform: "uppercase",
  },
})

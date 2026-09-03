import {
  createSeethingSwarmAnimalPresentationGeometry,
  SEETHING_SWARM_HUB_FRAME_DURATION_MS,
  SEETHING_SWARM_HUB_TILE_SIZE,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { SeethingSwarmRuntimeCharacterClip } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import { useEffect } from "react"
import { Image, View, type ImageStyle, type ViewStyle } from "react-native"
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated"

export default function NativeSeethingSwarmAnimal({
  clip,
  shouldReduceMotion,
}: {
  clip: SeethingSwarmRuntimeCharacterClip<number>
  shouldReduceMotion: boolean
}) {
  const frameProgress = useSharedValue(0)
  const geometry = createSeethingSwarmAnimalPresentationGeometry(
    clip.frameWidth,
    clip.frameHeight,
    clip.visibleBounds,
  )
  const scaledFrameWidth = clip.frameWidth * geometry.integerScale
  const scaledFrameHeight = clip.frameHeight * geometry.integerScale
  const scaledStripWidth = scaledFrameWidth * clip.frameCount
  const tileStyle: ViewStyle = {
    width: SEETHING_SWARM_HUB_TILE_SIZE,
    height: SEETHING_SWARM_HUB_TILE_SIZE,
    flexShrink: 0,
    overflow: "hidden",
  }
  const stripStyle: ViewStyle = {
    position: "absolute",
    left: geometry.frameOffsetX,
    top: geometry.frameOffsetY,
    width: scaledStripWidth,
    height: scaledFrameHeight,
  }
  const imageStyle: ImageStyle = {
    width: scaledStripWidth,
    height: scaledFrameHeight,
  }
  const animatedStyle = useAnimatedStyle(() => {
    const frameIndex = Math.min(
      clip.frameCount - 1,
      Math.floor(frameProgress.get()),
    )
    return {
      transform: [{ translateX: -frameIndex * scaledFrameWidth }],
    }
  })

  useEffect(() => {
    cancelAnimation(frameProgress)
    frameProgress.set(0)
    if (shouldReduceMotion || clip.frameCount === 1) return

    frameProgress.set(
      withRepeat(
        withTiming(clip.frameCount, {
          duration: clip.frameCount * SEETHING_SWARM_HUB_FRAME_DURATION_MS,
          easing: Easing.linear,
          reduceMotion: ReduceMotion.Never,
        }),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      ),
    )

    return () => cancelAnimation(frameProgress)
  }, [clip.frameCount, frameProgress, shouldReduceMotion])

  const testId = `seething-swarm-animal-${clip.animalId.replaceAll("/", "-")}`

  return (
    <View
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={tileStyle}
      testID={testId}
    >
      <Animated.View
        style={[stripStyle, animatedStyle]}
        testID={`${testId}-strip`}
      >
        <Image
          accessible={false}
          alt=""
          fadeDuration={0}
          resizeMode="stretch"
          source={clip.asset}
          style={imageStyle}
          testID={`${testId}-image`}
        />
      </Animated.View>
    </View>
  )
}

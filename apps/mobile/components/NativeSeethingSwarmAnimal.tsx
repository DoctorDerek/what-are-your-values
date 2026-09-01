import {
  SEETHING_SWARM_HUB_FRAME_DURATION_MS,
  SEETHING_SWARM_HUB_TILE_SIZE,
  type SeethingSwarmAnimalPresentation,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
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
  presentation,
  shouldReduceMotion,
}: {
  presentation: SeethingSwarmAnimalPresentation<number>
  shouldReduceMotion: boolean
}) {
  const frameProgress = useSharedValue(0)
  const scaledFrameWidth = presentation.frameWidth * presentation.integerScale
  const scaledFrameHeight = presentation.frameHeight * presentation.integerScale
  const scaledStripWidth = scaledFrameWidth * presentation.frameCount
  const tileStyle: ViewStyle = {
    width: SEETHING_SWARM_HUB_TILE_SIZE,
    height: SEETHING_SWARM_HUB_TILE_SIZE,
    flexShrink: 0,
    overflow: "hidden",
  }
  const stripStyle: ViewStyle = {
    position: "absolute",
    left: presentation.frameOffsetX,
    top: presentation.frameOffsetY,
    width: scaledStripWidth,
    height: scaledFrameHeight,
  }
  const imageStyle: ImageStyle = {
    width: scaledStripWidth,
    height: scaledFrameHeight,
  }
  const animatedStyle = useAnimatedStyle(() => {
    const frameIndex = Math.min(
      presentation.frameCount - 1,
      Math.floor(frameProgress.get()),
    )
    return {
      transform: [{ translateX: -frameIndex * scaledFrameWidth }],
    }
  })

  useEffect(() => {
    cancelAnimation(frameProgress)
    frameProgress.set(0)
    if (shouldReduceMotion || presentation.frameCount === 1) return

    frameProgress.set(
      withRepeat(
        withTiming(presentation.frameCount, {
          duration:
            presentation.frameCount * SEETHING_SWARM_HUB_FRAME_DURATION_MS,
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
  }, [frameProgress, presentation.frameCount, shouldReduceMotion])

  const testId = `seething-swarm-animal-${presentation.animalId.replaceAll("/", "-")}`

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
          source={presentation.asset}
          style={imageStyle}
          testID={`${testId}-image`}
        />
      </Animated.View>
    </View>
  )
}

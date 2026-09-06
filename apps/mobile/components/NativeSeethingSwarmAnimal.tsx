import {
  createSeethingSwarmAnimalPresentationGeometry,
  SEETHING_SWARM_HUB_FRAME_DURATION_MS,
  SEETHING_SWARM_HUB_TILE_SIZE,
  type SeethingSwarmAnimalFacingDirection,
  type SeethingSwarmAnimalPlaybackMode,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { SeethingSwarmRuntimeCharacterClip } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import { useEffect, useRef, useState } from "react"
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
import { scheduleOnRN } from "react-native-worklets"

export default function NativeSeethingSwarmAnimal({
  clip,
  facing = "right",
  frameDurationMs = SEETHING_SWARM_HUB_FRAME_DURATION_MS,
  maximumIntegerScale,
  playbackMode = "loop",
  shouldReduceMotion,
  tileSize = SEETHING_SWARM_HUB_TILE_SIZE,
  onPlaybackComplete,
  onLoadError,
  onReady,
}: {
  clip: SeethingSwarmRuntimeCharacterClip<number>
  facing?: SeethingSwarmAnimalFacingDirection
  frameDurationMs?: number
  maximumIntegerScale?: number
  playbackMode?: SeethingSwarmAnimalPlaybackMode
  shouldReduceMotion: boolean
  tileSize?: number
  onPlaybackComplete?: () => void
  onLoadError?: () => void
  onReady?: () => void
}) {
  const frameProgress = useSharedValue(0)
  const [loadedAsset, setLoadedAsset] = useState<number | null>(null)
  const playbackCompleteRef = useRef(onPlaybackComplete)
  useEffect(() => {
    playbackCompleteRef.current = onPlaybackComplete
  }, [onPlaybackComplete])
  const geometry = createSeethingSwarmAnimalPresentationGeometry(
    clip.frameWidth,
    clip.frameHeight,
    clip.visibleBounds,
    tileSize,
    maximumIntegerScale,
  )
  const scaledFrameWidth = clip.frameWidth * geometry.integerScale
  const scaledFrameHeight = clip.frameHeight * geometry.integerScale
  const scaledStripWidth = scaledFrameWidth * clip.frameCount
  const tileStyle: ViewStyle = {
    width: tileSize,
    height: tileSize,
    transform: [{ scaleX: facing === "left" ? -1 : 1 }],
  }
  const stripStyle: ViewStyle = {
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
    let isActive = true
    const finishPlayback = () => {
      if (isActive) playbackCompleteRef.current?.()
    }
    cancelAnimation(frameProgress)
    frameProgress.set(
      playbackMode === "hold-final-frame" ? clip.frameCount - 1 : 0,
    )
    if (loadedAsset !== clip.asset) return
    if (shouldReduceMotion || clip.frameCount === 1) {
      if (playbackMode === "one-shot") finishPlayback()
      return
    }
    if (playbackMode === "static" || playbackMode === "hold-final-frame") return

    const animation = withTiming(
      clip.frameCount,
      {
        duration: clip.frameCount * frameDurationMs,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      },
      (finished) => {
        if (finished && playbackMode === "one-shot")
          scheduleOnRN(finishPlayback)
      },
    )
    frameProgress.set(
      playbackMode === "loop"
        ? withRepeat(animation, -1, false, undefined, ReduceMotion.Never)
        : animation,
    )

    return () => {
      isActive = false
      cancelAnimation(frameProgress)
    }
  }, [
    clip.asset,
    clip.frameCount,
    frameDurationMs,
    frameProgress,
    loadedAsset,
    playbackMode,
    shouldReduceMotion,
  ])

  const testId = `seething-swarm-animal-${clip.animalId.replaceAll("/", "-")}`

  return (
    <View
      accessibilityElementsHidden
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      className="shrink-0 overflow-hidden"
      style={tileStyle}
      testID={testId}
    >
      <Animated.View
        className="absolute"
        style={[stripStyle, animatedStyle]}
        testID={`${testId}-strip`}
      >
        <Image
          accessible={false}
          alt=""
          fadeDuration={0}
          onLoad={() => {
            setLoadedAsset(clip.asset)
            onReady?.()
          }}
          onError={onLoadError}
          resizeMode="stretch"
          source={clip.asset}
          style={imageStyle}
          testID={`${testId}-image`}
        />
      </Animated.View>
    </View>
  )
}

import {
  createSeethingSwarmAnimalPresentationGeometry,
  SEETHING_SWARM_HUB_FRAME_DURATION_MS,
  SEETHING_SWARM_HUB_TILE_SIZE,
  type SeethingSwarmAnimalFacingDirection,
  type SeethingSwarmAnimalPlaybackMode,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { SeethingSwarmRuntimeCharacterClip } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import Image, { type StaticImageData } from "next/image"
import { useState, type CSSProperties } from "react"

type SeethingSwarmAnimalStyle = CSSProperties & {
  "--animal-animation-duration": string
  "--animal-frame-count": number
  "--animal-strip-height": string
  "--animal-strip-left": string
  "--animal-strip-top": string
  "--animal-strip-travel": string
  "--animal-strip-width": string
}

type SeethingSwarmAnimalTileStyle = CSSProperties & {
  "--animal-tile-size": string
}

export default function SeethingSwarmAnimal({
  clip,
  facing = "right",
  frameDurationMs = SEETHING_SWARM_HUB_FRAME_DURATION_MS,
  maximumIntegerScale,
  playbackMode = "loop",
  shouldReduceMotion,
  tileSize = SEETHING_SWARM_HUB_TILE_SIZE,
  onLoadError,
  onReady,
  onPlaybackComplete,
}: {
  clip: SeethingSwarmRuntimeCharacterClip<StaticImageData>
  facing?: SeethingSwarmAnimalFacingDirection
  frameDurationMs?: number
  maximumIntegerScale?: number
  playbackMode?: SeethingSwarmAnimalPlaybackMode
  shouldReduceMotion: boolean
  tileSize?: number
  onLoadError?: () => void
  onReady?: () => void
  onPlaybackComplete?: () => void
}) {
  const [loadedAssetSource, setLoadedAssetSource] = useState<string | null>(
    null,
  )
  const isImageLoaded = loadedAssetSource === clip.asset.src
  const effectivePlaybackMode =
    shouldReduceMotion &&
    (playbackMode === "loop" || playbackMode === "one-shot")
      ? "static"
      : playbackMode
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
  const stripLeft =
    effectivePlaybackMode === "hold-final-frame"
      ? geometry.frameOffsetX - scaledFrameWidth * (clip.frameCount - 1)
      : geometry.frameOffsetX
  const stripStyle: SeethingSwarmAnimalStyle = {
    "--animal-animation-duration": `${clip.frameCount * frameDurationMs}ms`,
    "--animal-frame-count": clip.frameCount,
    "--animal-strip-height": `${scaledFrameHeight}px`,
    "--animal-strip-left": `${stripLeft}px`,
    "--animal-strip-top": `${geometry.frameOffsetY}px`,
    "--animal-strip-travel": `${-scaledStripWidth}px`,
    "--animal-strip-width": `${scaledStripWidth}px`,
  }
  const tileStyle: SeethingSwarmAnimalTileStyle = {
    "--animal-tile-size": `${tileSize}px`,
  }
  const playbackClassName =
    effectivePlaybackMode === "loop"
      ? "animate-seething-swarm-strip [animation-iteration-count:infinite]"
      : effectivePlaybackMode === "one-shot"
        ? "animate-seething-swarm-strip"
        : "animate-none"

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none relative block size-(--animal-tile-size) flex-[0_0_var(--animal-tile-size)] overflow-hidden select-none ${facing === "left" ? "-scale-x-100" : ""}`}
      data-animal-id={clip.animalId}
      data-facing={facing}
      data-frame-count={clip.frameCount}
      data-playback-mode={effectivePlaybackMode}
      data-playback-ready={isImageLoaded}
      data-reduced-motion={shouldReduceMotion}
      style={tileStyle}
    >
      <Image
        alt=""
        className={`absolute top-(--animal-strip-top) left-(--animal-strip-left) h-(--animal-strip-height) w-(--animal-strip-width) max-w-none [image-rendering:pixelated] ${playbackClassName} ${isImageLoaded ? "" : "[animation-play-state:paused]"}`}
        draggable={false}
        height={scaledFrameHeight}
        loading={playbackMode === "one-shot" ? "eager" : undefined}
        onAnimationEnd={
          effectivePlaybackMode === "one-shot" && isImageLoaded
            ? onPlaybackComplete
            : undefined
        }
        onError={onLoadError}
        onLoad={() => {
          setLoadedAssetSource(clip.asset.src)
          onReady?.()
        }}
        src={clip.asset}
        style={stripStyle}
        unoptimized
        width={scaledStripWidth}
      />
    </span>
  )
}

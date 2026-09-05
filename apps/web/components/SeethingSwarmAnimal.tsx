import {
  createSeethingSwarmAnimalPresentationGeometry,
  SEETHING_SWARM_HUB_FRAME_DURATION_MS,
  SEETHING_SWARM_HUB_TILE_SIZE,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { SeethingSwarmRuntimeCharacterClip } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import Image, { type StaticImageData } from "next/image"
import type { CSSProperties } from "react"

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

export const SEETHING_SWARM_ANIMAL_PLAYBACK_MODES = Object.freeze([
  "loop",
  "one-shot",
  "hold-final-frame",
  "static",
] as const)

export type SeethingSwarmAnimalPlaybackMode =
  (typeof SEETHING_SWARM_ANIMAL_PLAYBACK_MODES)[number]

export const SEETHING_SWARM_ANIMAL_FACING_DIRECTIONS = Object.freeze([
  "left",
  "right",
] as const)

export type SeethingSwarmAnimalFacingDirection =
  (typeof SEETHING_SWARM_ANIMAL_FACING_DIRECTIONS)[number]

export default function SeethingSwarmAnimal({
  clip,
  facing = "right",
  frameDurationMs = SEETHING_SWARM_HUB_FRAME_DURATION_MS,
  playbackMode = "loop",
  shouldReduceMotion,
  tileSize = SEETHING_SWARM_HUB_TILE_SIZE,
  onPlaybackComplete,
}: {
  clip: SeethingSwarmRuntimeCharacterClip<StaticImageData>
  facing?: SeethingSwarmAnimalFacingDirection
  frameDurationMs?: number
  playbackMode?: SeethingSwarmAnimalPlaybackMode
  shouldReduceMotion: boolean
  tileSize?: number
  onPlaybackComplete?: () => void
}) {
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
      data-reduced-motion={shouldReduceMotion}
      style={tileStyle}
    >
      <Image
        alt=""
        className={`absolute top-(--animal-strip-top) left-(--animal-strip-left) h-(--animal-strip-height) w-(--animal-strip-width) max-w-none [image-rendering:pixelated] ${playbackClassName}`}
        draggable={false}
        height={scaledFrameHeight}
        onAnimationEnd={
          effectivePlaybackMode === "one-shot" ? onPlaybackComplete : undefined
        }
        src={clip.asset}
        style={stripStyle}
        unoptimized
        width={scaledStripWidth}
      />
    </span>
  )
}

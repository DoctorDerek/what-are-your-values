import {
  createSeethingSwarmAnimalPresentationGeometry,
  SEETHING_SWARM_HUB_FRAME_DURATION_MS,
  SEETHING_SWARM_HUB_TILE_SIZE,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
import type { SeethingSwarmRuntimeCharacterClip } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import Image, { type StaticImageData } from "next/image"
import type { CSSProperties } from "react"
import styles from "./SeethingSwarmAnimal.module.css"

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
  shouldReduceMotion,
}: {
  clip: SeethingSwarmRuntimeCharacterClip<StaticImageData>
  shouldReduceMotion: boolean
}) {
  const geometry = createSeethingSwarmAnimalPresentationGeometry(
    clip.frameWidth,
    clip.frameHeight,
    clip.visibleBounds,
  )
  const scaledFrameWidth = clip.frameWidth * geometry.integerScale
  const scaledFrameHeight = clip.frameHeight * geometry.integerScale
  const scaledStripWidth = scaledFrameWidth * clip.frameCount
  const stripStyle: SeethingSwarmAnimalStyle = {
    "--animal-animation-duration": `${clip.frameCount * SEETHING_SWARM_HUB_FRAME_DURATION_MS}ms`,
    "--animal-frame-count": clip.frameCount,
    "--animal-strip-height": `${scaledFrameHeight}px`,
    "--animal-strip-left": `${geometry.frameOffsetX}px`,
    "--animal-strip-top": `${geometry.frameOffsetY}px`,
    "--animal-strip-travel": `${-scaledStripWidth}px`,
    "--animal-strip-width": `${scaledStripWidth}px`,
  }
  const tileStyle: SeethingSwarmAnimalTileStyle = {
    "--animal-tile-size": `${SEETHING_SWARM_HUB_TILE_SIZE}px`,
  }

  return (
    <span
      aria-hidden="true"
      className={styles.tile}
      data-animal-id={clip.animalId}
      data-frame-count={clip.frameCount}
      data-reduced-motion={shouldReduceMotion}
      style={tileStyle}
    >
      <Image
        alt=""
        className={`${styles.strip} ${shouldReduceMotion ? styles.staticStrip : ""}`}
        draggable={false}
        height={scaledFrameHeight}
        src={clip.asset}
        style={stripStyle}
        unoptimized
        width={scaledStripWidth}
      />
    </span>
  )
}

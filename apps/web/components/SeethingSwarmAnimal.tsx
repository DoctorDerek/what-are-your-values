import {
  SEETHING_SWARM_HUB_FRAME_DURATION_MS,
  SEETHING_SWARM_HUB_TILE_SIZE,
  type SeethingSwarmAnimalPresentation,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
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
  presentation,
  shouldReduceMotion,
}: {
  presentation: SeethingSwarmAnimalPresentation<StaticImageData>
  shouldReduceMotion: boolean
}) {
  const scaledFrameWidth = presentation.frameWidth * presentation.integerScale
  const scaledFrameHeight = presentation.frameHeight * presentation.integerScale
  const scaledStripWidth = scaledFrameWidth * presentation.frameCount
  const stripStyle: SeethingSwarmAnimalStyle = {
    "--animal-animation-duration": `${presentation.frameCount * SEETHING_SWARM_HUB_FRAME_DURATION_MS}ms`,
    "--animal-frame-count": presentation.frameCount,
    "--animal-strip-height": `${scaledFrameHeight}px`,
    "--animal-strip-left": `${presentation.frameOffsetX}px`,
    "--animal-strip-top": `${presentation.frameOffsetY}px`,
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
      data-animal-id={presentation.animalId}
      data-frame-count={presentation.frameCount}
      data-reduced-motion={shouldReduceMotion}
      style={tileStyle}
    >
      <Image
        alt=""
        className={`${styles.strip} ${shouldReduceMotion ? styles.staticStrip : ""}`}
        draggable={false}
        height={scaledFrameHeight}
        src={presentation.asset}
        style={stripStyle}
        unoptimized
        width={scaledStripWidth}
      />
    </span>
  )
}

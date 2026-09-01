import type {
  SeethingSwarmAnimalPresentation,
  SeethingSwarmAnimalPresentationAdapter,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
import { render, screen } from "@testing-library/react"
import type { CSSProperties } from "react"
import { describe, expect, it, vi } from "vitest"
import SeethingSwarmAnimal from "./SeethingSwarmAnimal"
import styles from "./SeethingSwarmAnimal.module.css"

type MockStaticImageData = Readonly<{
  src: string
  width: number
  height: number
}>

type MockNextImageProps = Readonly<{
  alt: string
  className: string
  draggable: boolean
  height: number
  src: MockStaticImageData
  style: CSSProperties
  unoptimized: boolean
  width: number
}>

vi.mock("next/image", () => ({
  default: ({
    alt,
    className,
    draggable,
    height,
    src,
    style,
    unoptimized,
    width,
  }: MockNextImageProps) => (
    <span
      className={className}
      data-alt={alt}
      data-draggable={draggable}
      data-height={height}
      data-src={src.src}
      data-testid="next-image"
      data-unoptimized={unoptimized}
      data-width={width}
      style={style}
    />
  ),
}))

const presentation = Object.freeze({
  animalId: "bat",
  animationId: "idle_upright",
  relativePath: "bat_spritesheets/bat_idle_upright_strip4.png",
  frameWidth: 4,
  frameHeight: 4,
  frameCount: 4,
  visibleBounds: Object.freeze({ left: 1, top: 1, width: 2, height: 2 }),
  integerScale: 36,
  frameOffsetX: -36,
  frameOffsetY: -36,
  asset: Object.freeze({
    src: "/generated/seethingswarm/bat-idle.png",
    width: 16,
    height: 4,
  }),
}) satisfies SeethingSwarmAnimalPresentation<MockStaticImageData>

const licensedAdapter = Object.freeze({
  mode: "licensed",
  evidenceSnapshotId: "seethingswarm-animals:2026-03-15",
  animals: Object.freeze([presentation]),
}) satisfies SeethingSwarmAnimalPresentationAdapter<MockStaticImageData>

describe("SeethingSwarmAnimal", () => {
  it("reserves fixed geometry and animates source pixels in discrete authored frames", () => {
    render(
      <SeethingSwarmAnimal
        presentation={licensedAdapter.animals[0]!}
        shouldReduceMotion={false}
      />,
    )

    const image = screen.getByTestId("next-image")
    const tile = image.parentElement
    expect(tile).toHaveAttribute("aria-hidden", "true")
    expect(tile).toHaveAttribute("data-animal-id", "bat")
    expect(tile).toHaveAttribute("data-frame-count", "4")
    expect(tile).toHaveAttribute("data-reduced-motion", "false")
    expect(tile).toHaveStyle({ "--animal-tile-size": "72px" })
    expect(image).toHaveAttribute("data-alt", "")
    expect(image).toHaveAttribute("data-draggable", "false")
    expect(image).toHaveAttribute("data-unoptimized", "true")
    expect(image).toHaveAttribute("data-src", presentation.asset.src)
    expect(image).toHaveAttribute("data-width", "576")
    expect(image).toHaveAttribute("data-height", "144")
    expect(image).toHaveStyle({
      "--animal-animation-duration": "640ms",
      "--animal-frame-count": "4",
      "--animal-strip-height": "144px",
      "--animal-strip-left": "-36px",
      "--animal-strip-top": "-36px",
      "--animal-strip-travel": "-576px",
      "--animal-strip-width": "576px",
    })
    expect(image).toHaveClass(styles.strip)
    expect(image).not.toHaveClass(styles.staticStrip)
    expect(tile).not.toHaveAttribute("tabindex")
  })

  it("keeps the first authored frame static when Reduced Motion is active", () => {
    render(
      <SeethingSwarmAnimal presentation={presentation} shouldReduceMotion />,
    )

    const image = screen.getByTestId("next-image")
    expect(image.parentElement).toHaveAttribute("data-reduced-motion", "true")
    expect(image).toHaveClass(styles.strip, styles.staticStrip)
    expect(image).toHaveStyle({
      "--animal-strip-left": "-36px",
      "--animal-strip-top": "-36px",
      "--animal-strip-travel": "-576px",
    })
  })
})

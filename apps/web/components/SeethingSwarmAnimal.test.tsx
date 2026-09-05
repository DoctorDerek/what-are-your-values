import type { SeethingSwarmRuntimeCharacterClip } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import { render, screen } from "@testing-library/react"
import type { StaticImageData } from "next/image"
import { describe, expect, it, vi } from "vitest"
import SeethingSwarmAnimal from "./SeethingSwarmAnimal"

const clip = Object.freeze({
  kind: "character",
  animalId: "bat",
  animationId: "idle_upright",
  relativePath: "bat_spritesheets/bat_idle_upright_strip4.png",
  frameWidth: 4,
  frameHeight: 4,
  frameCount: 4,
  visibleBounds: Object.freeze({ left: 1, top: 1, width: 2, height: 2 }),
  asset: Object.freeze({
    src: "/generated/seethingswarm/bat-idle.png",
    width: 16,
    height: 4,
  }),
}) satisfies SeethingSwarmRuntimeCharacterClip<StaticImageData>

describe("SeethingSwarmAnimal", () => {
  it("reserves fixed geometry and animates source pixels in discrete authored frames", () => {
    render(<SeethingSwarmAnimal clip={clip} shouldReduceMotion={false} />)

    const image = screen.getByAltText("")
    const tile = image.parentElement
    expect(tile).toHaveAttribute("aria-hidden", "true")
    expect(tile).toHaveAttribute("data-animal-id", "bat")
    expect(tile).toHaveAttribute("data-facing", "right")
    expect(tile).toHaveAttribute("data-frame-count", "4")
    expect(tile).toHaveAttribute("data-playback-mode", "loop")
    expect(tile).toHaveAttribute("data-reduced-motion", "false")
    expect(tile).toHaveStyle({ "--animal-tile-size": "72px" })
    expect(image).toHaveAttribute("alt", "")
    expect(image).toHaveAttribute("draggable", "false")
    expect(image).toHaveAttribute("src", clip.asset.src)
    expect(image).not.toHaveAttribute("srcset")
    expect(image).toHaveAttribute("width", "576")
    expect(image).toHaveAttribute("height", "144")
    expect(image).toHaveStyle({
      "--animal-animation-duration": "640ms",
      "--animal-frame-count": "4",
      "--animal-strip-height": "144px",
      "--animal-strip-left": "-36px",
      "--animal-strip-top": "-36px",
      "--animal-strip-travel": "-576px",
      "--animal-strip-width": "576px",
    })
    expect(tile).not.toHaveAttribute("tabindex")
  })

  it("keeps the first authored frame static when Reduced Motion is active", () => {
    render(<SeethingSwarmAnimal clip={clip} shouldReduceMotion />)

    const image = screen.getByAltText("")
    expect(image.parentElement).toHaveAttribute("data-reduced-motion", "true")
    expect(image.parentElement).toHaveAttribute("data-playback-mode", "static")
    expect(image).toHaveStyle({
      "--animal-strip-left": "-36px",
      "--animal-strip-top": "-36px",
      "--animal-strip-travel": "-576px",
    })
  })

  it("plays one authored sequence once with custom geometry and reports its completion", () => {
    const onPlaybackComplete = vi.fn()
    render(
      <SeethingSwarmAnimal
        clip={clip}
        facing="left"
        frameDurationMs={100}
        playbackMode="one-shot"
        shouldReduceMotion={false}
        tileSize={96}
        onPlaybackComplete={onPlaybackComplete}
      />,
    )

    const image = screen.getByAltText("")
    const tile = image.parentElement
    expect(tile).toHaveAttribute("data-facing", "left")
    expect(tile).toHaveAttribute("data-playback-mode", "one-shot")
    expect(tile).toHaveStyle({ "--animal-tile-size": "96px" })
    expect(image).toHaveStyle({
      "--animal-animation-duration": "400ms",
      "--animal-strip-height": "192px",
      "--animal-strip-left": "-48px",
      "--animal-strip-top": "-48px",
      "--animal-strip-travel": "-768px",
      "--animal-strip-width": "768px",
    })

    image.dispatchEvent(new AnimationEvent("animationend", { bubbles: true }))
    expect(onPlaybackComplete).toHaveBeenCalledTimes(1)
  })

  it("holds the final authored frame without emitting animation completion", () => {
    const onPlaybackComplete = vi.fn()
    render(
      <SeethingSwarmAnimal
        clip={clip}
        playbackMode="hold-final-frame"
        shouldReduceMotion={false}
        onPlaybackComplete={onPlaybackComplete}
      />,
    )

    const image = screen.getByAltText("")
    expect(image.parentElement).toHaveAttribute(
      "data-playback-mode",
      "hold-final-frame",
    )
    expect(image).toHaveStyle({ "--animal-strip-left": "-468px" })

    image.dispatchEvent(new AnimationEvent("animationend", { bubbles: true }))
    expect(onPlaybackComplete).not.toHaveBeenCalled()
  })

  it("preserves an explicitly static representative frame", () => {
    render(
      <SeethingSwarmAnimal
        clip={clip}
        playbackMode="static"
        shouldReduceMotion={false}
      />,
    )

    const image = screen.getByAltText("")
    expect(image.parentElement).toHaveAttribute("data-playback-mode", "static")
    expect(image).toHaveStyle({ "--animal-strip-left": "-36px" })
  })
})

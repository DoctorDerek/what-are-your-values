import type { SeethingSwarmRuntimeCharacterClip } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { getAnimatedStyle } from "react-native-reanimated"
import NativeSeethingSwarmAnimal from "@/components/NativeSeethingSwarmAnimal"

const clip = Object.freeze({
  kind: "character",
  animalId: "bat",
  animationId: "idle_upright",
  relativePath: "bat_spritesheets/bat_idle_upright_strip4.png",
  frameWidth: 4,
  frameHeight: 4,
  frameCount: 4,
  visibleBounds: Object.freeze({ left: 1, top: 1, width: 2, height: 2 }),
  asset: 7,
}) satisfies SeethingSwarmRuntimeCharacterClip<number>
const hidden = { includeHiddenElements: true }
const getStrip = () =>
  screen.getByTestId("seething-swarm-animal-bat-strip", hidden)
const getImage = () =>
  screen.getByTestId("seething-swarm-animal-bat-image", hidden)
async function advance(milliseconds: number) {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds)
  })
}

beforeEach(() => {
  jest.useFakeTimers()
})
afterEach(() => {
  jest.useRealTimers()
})

describe("NativeSeethingSwarmAnimal", () => {
  it("restarts a resident strip for a new cue and cancels its previous completion", async () => {
    const complete = jest.fn()
    const props = { clip, shouldReduceMotion: false, playbackMode: "one-shot" as const, onPlaybackComplete: complete }
    const { rerender } = await render(<NativeSeethingSwarmAnimal {...props} playbackIdentity="attention:0" />)
    await fireEvent(getImage(), "load")
    const residentImage = getImage()
    await advance(360)
    await rerender(<NativeSeethingSwarmAnimal {...props} playbackIdentity="strike:0" />)
    expect(getImage()).toBe(residentImage)
    expect(getAnimatedStyle(getStrip())).toMatchObject({ transform: [{ translateX: -0 }] })
    await advance(360)
    expect(complete).not.toHaveBeenCalled()
    await advance(400)
    expect(complete).toHaveBeenCalledTimes(1)
  })
  it("preserves integer geometry, facing, asset pixels, and decorative semantics", async () => {
    await render(
      <NativeSeethingSwarmAnimal
        clip={clip}
        shouldReduceMotion
        facing="left"
      />,
    )
    const tile = screen.getByTestId("seething-swarm-animal-bat", hidden)
    expect(screen.queryByTestId("seething-swarm-animal-bat")).toBeNull()
    expect(tile).toHaveProp("accessible", false)
    expect(tile).toHaveProp("accessibilityElementsHidden", true)
    expect(tile).toHaveProp("importantForAccessibility", "no-hide-descendants")
    expect(tile).toHaveProp("pointerEvents", "none")
    expect(tile).toHaveStyle({
      width: 72,
      height: 72,
      transform: [{ scaleX: -1 }],
    })
    expect(getStrip()).toHaveStyle({
      left: -36,
      top: -36,
      width: 576,
      height: 144,
      transform: [{ translateX: -0 }],
    })
    expect(getImage()).toHaveProp("source", 7)
    expect(getImage()).toHaveProp("fadeDuration", 0)
    expect(getImage()).toHaveProp("alt", "")
    expect(getImage()).toHaveStyle({ width: 576, height: 144 })
  })

  it("waits for load and advances discrete frames through a complete one-shot", async () => {
    const complete = jest.fn()
    await render(
      <NativeSeethingSwarmAnimal
        clip={clip}
        shouldReduceMotion={false}
        playbackMode="one-shot"
        onPlaybackComplete={complete}
      />,
    )
    await advance(1000)
    expect(complete).not.toHaveBeenCalled()
    expect(getAnimatedStyle(getStrip())).toMatchObject({
      transform: [{ translateX: -0 }],
    })
    await fireEvent(getImage(), "load")
    await advance(360)
    expect(getAnimatedStyle(getStrip())).toMatchObject({
      transform: [{ translateX: -288 }],
    })
    expect(complete).not.toHaveBeenCalled()
    await advance(400)
    expect(getAnimatedStyle(getStrip())).toMatchObject({
      transform: [{ translateX: -432 }],
    })
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it("loops without emitting a result and cancels on unmount", async () => {
    const complete = jest.fn()
    const { unmount } = await render(
      <NativeSeethingSwarmAnimal
        clip={clip}
        shouldReduceMotion={false}
        onPlaybackComplete={complete}
      />,
    )
    await fireEvent(getImage(), "load")
    await advance(540)
    expect(getAnimatedStyle(getStrip())).toMatchObject({
      transform: [{ translateX: -432 }],
    })
    await advance(240)
    expect(getAnimatedStyle(getStrip())).toMatchObject({
      transform: [{ translateX: -0 }],
    })
    expect(complete).not.toHaveBeenCalled()
    await unmount()
    await advance(1000)
    expect(complete).not.toHaveBeenCalled()
  })

  it("holds final frames at the shared combatant scale and supports a static frame", async () => {
    const props = {
      clip,
      shouldReduceMotion: false,
      tileSize: 112,
      maximumIntegerScale: 20,
    }
    const { rerender } = await render(
      <NativeSeethingSwarmAnimal {...props} playbackMode="hold-final-frame" />,
    )
    await fireEvent(getImage(), "load")
    await advance(1000)
    expect(getStrip()).toHaveStyle({
      left: 16,
      top: 52,
      width: 320,
      height: 80,
    })
    expect(getAnimatedStyle(getStrip())).toMatchObject({
      transform: [{ translateX: -240 }],
    })
    await rerender(
      <NativeSeethingSwarmAnimal {...props} playbackMode="static" />,
    )
    expect(getAnimatedStyle(getStrip())).toMatchObject({
      transform: [{ translateX: -0 }],
    })
  })

  it("completes single-frame and reduced-motion one-shots without animated delay", async () => {
    for (const scenario of [
      { shouldReduceMotion: true, clip },
      { shouldReduceMotion: false, clip: { ...clip, frameCount: 1 } },
    ]) {
      const complete = jest.fn()
      const { unmount } = await render(
        <NativeSeethingSwarmAnimal
          {...scenario}
          playbackMode="one-shot"
          onPlaybackComplete={complete}
        />,
      )
      await fireEvent(getImage(), "load")
      expect(getStrip()).toHaveStyle({ transform: [{ translateX: -0 }] })
      expect(complete).toHaveBeenCalledTimes(1)
      await unmount()
    }
  })

  it("uses the latest callback without restarting and rejects canceled work", async () => {
    const prior = jest.fn()
    const latest = jest.fn()
    const props = {
      clip,
      shouldReduceMotion: false,
      playbackMode: "one-shot" as const,
    }
    const { rerender, unmount } = await render(
      <NativeSeethingSwarmAnimal {...props} onPlaybackComplete={prior} />,
    )
    await fireEvent(getImage(), "load")
    await advance(350)
    await rerender(
      <NativeSeethingSwarmAnimal {...props} onPlaybackComplete={latest} />,
    )
    await advance(400)
    expect(prior).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledTimes(1)
    await rerender(
      <NativeSeethingSwarmAnimal
        {...props}
        clip={{ ...clip, asset: 8 }}
        onPlaybackComplete={prior}
      />,
    )
    await fireEvent(getImage(), "load")
    await advance(200)
    await unmount()
    await advance(1000)
    expect(prior).not.toHaveBeenCalled()
  })

  it("reports image failure to its scoped combatant fallback", async () => {
    const onLoadError = jest.fn()
    await render(
      <NativeSeethingSwarmAnimal
        clip={clip}
        shouldReduceMotion
        onLoadError={onLoadError}
      />,
    )
    await fireEvent(getImage(), "error", {
      nativeEvent: { error: "decode failed" },
    })
    expect(onLoadError).toHaveBeenCalledTimes(1)
  })
})

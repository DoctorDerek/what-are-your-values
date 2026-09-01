import type { SeethingSwarmAnimalPresentation } from "@game/data/src/SeethingSwarmAnimalPresentation"
import { describe, expect, it, jest } from "@jest/globals"
import { render, screen } from "@testing-library/react-native"
import { StyleSheet } from "react-native"
import * as Reanimated from "react-native-reanimated"
import NativeSeethingSwarmAnimal from "@/components/NativeSeethingSwarmAnimal"

jest.mock("react-native-reanimated", () => {
  const reanimatedMock = jest.requireActual<
    typeof import("react-native-reanimated")
  >("react-native-reanimated/mock")
  return {
    ...reanimatedMock,
    withRepeat: jest.fn((animation: number) => animation),
    withTiming: jest.fn((toValue: number) => toValue),
  }
})

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
  asset: 7,
}) satisfies SeethingSwarmAnimalPresentation<number>

describe("NativeSeethingSwarmAnimal", () => {
  it("reserves fixed bottom-anchored geometry with hidden decorative semantics", async () => {
    await render(
      <NativeSeethingSwarmAnimal
        presentation={presentation}
        shouldReduceMotion
      />,
    )

    const hiddenQuery = { includeHiddenElements: true }
    const tile = screen.getByTestId("seething-swarm-animal-bat", hiddenQuery)
    const strip = screen.getByTestId(
      "seething-swarm-animal-bat-strip",
      hiddenQuery,
    )
    const image = screen.getByTestId(
      "seething-swarm-animal-bat-image",
      hiddenQuery,
    )
    expect(tile).toHaveProp("accessible", false)
    expect(tile).toHaveProp("accessibilityElementsHidden", true)
    expect(tile).toHaveProp("importantForAccessibility", "no-hide-descendants")
    expect(tile).toHaveProp("pointerEvents", "none")
    expect(tile).toHaveStyle({
      width: 72,
      height: 72,
      flexShrink: 0,
      overflow: "hidden",
    })
    expect(StyleSheet.flatten(strip.props.style)).toMatchObject({
      position: "absolute",
      left: -36,
      top: -36,
      width: 576,
      height: 144,
      transform: [{ translateX: -0 }],
    })
    expect(image).toHaveProp("accessible", false)
    expect(image).toHaveProp("alt", "")
    expect(image).toHaveProp("fadeDuration", 0)
    expect(image).toHaveProp("resizeMode", "stretch")
    expect(image).toHaveProp("source", 7)
    expect(image).toHaveStyle({ width: 576, height: 144 })
  })

  it("starts a quantized UI-thread loop only when resolved motion is allowed", async () => {
    const timingMock = jest.mocked(Reanimated.withTiming)
    const repeatMock = jest.mocked(Reanimated.withRepeat)

    await render(
      <NativeSeethingSwarmAnimal
        presentation={presentation}
        shouldReduceMotion={false}
      />,
    )

    expect(timingMock).toHaveBeenCalledWith(4, {
      duration: 640,
      easing: Reanimated.Easing.linear,
      reduceMotion: Reanimated.ReduceMotion.Never,
    })
    expect(repeatMock).toHaveBeenCalledWith(
      expect.anything(),
      -1,
      false,
      undefined,
      Reanimated.ReduceMotion.Never,
    )
  })

  it("does not create an animation for Reduced Motion or a single authored frame", async () => {
    const timingMock = jest.mocked(Reanimated.withTiming)
    const repeatMock = jest.mocked(Reanimated.withRepeat)
    const { rerender } = await render(
      <NativeSeethingSwarmAnimal
        presentation={presentation}
        shouldReduceMotion
      />,
    )

    expect(timingMock).not.toHaveBeenCalled()
    expect(repeatMock).not.toHaveBeenCalled()

    await rerender(
      <NativeSeethingSwarmAnimal
        presentation={{ ...presentation, frameCount: 1 }}
        shouldReduceMotion={false}
      />,
    )

    expect(timingMock).not.toHaveBeenCalled()
    expect(repeatMock).not.toHaveBeenCalled()
    const strip = screen.getByTestId("seething-swarm-animal-bat-strip", {
      includeHiddenElements: true,
    })
    expect(StyleSheet.flatten(strip.props.style)).toMatchObject({
      transform: [{ translateX: -0 }],
    })
  })
})

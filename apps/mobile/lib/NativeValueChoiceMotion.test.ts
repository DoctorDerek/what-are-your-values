import { describe, expect, it } from "vitest"
import { createNativeValueChoiceMotion } from "./NativeValueChoiceMotion"

describe("Native Value Choice Motion", () => {
  it("keeps an idle card fully visible at rest", () => {
    expect(
      createNativeValueChoiceMotion({
        position: "first",
        isWinner: false,
        isDefeated: false,
        shouldReduceMotion: false,
      }),
    ).toEqual({
      durationMilliseconds: 260,
      opacity: 1,
      scale: 1,
      translateY: 0,
    })
  })

  it("emphasizes the selected winner without moving it", () => {
    expect(
      createNativeValueChoiceMotion({
        position: "second",
        isWinner: true,
        isDefeated: false,
        shouldReduceMotion: false,
      }),
    ).toMatchObject({ opacity: 1, scale: 1.04, translateY: 0 })
  })

  it.each([
    ["first", -24],
    ["second", 24],
  ] as const)(
    "moves a defeated %s card away from its opponent",
    (position, translateY) => {
      expect(
        createNativeValueChoiceMotion({
          position,
          isWinner: false,
          isDefeated: true,
          shouldReduceMotion: false,
        }),
      ).toMatchObject({ opacity: 0.35, scale: 0.92, translateY })
    },
  )

  it("turns reduced motion into an immediate semantic transition", () => {
    expect(
      createNativeValueChoiceMotion({
        position: "first",
        isWinner: true,
        isDefeated: false,
        shouldReduceMotion: true,
      }).durationMilliseconds,
    ).toBe(0)
  })
})

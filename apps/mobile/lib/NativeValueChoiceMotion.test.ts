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

  it.each([
    {
      position: "first" as const,
      isWinner: false,
      isDefeated: true,
      expectedOpacity: 0.35,
    },
    {
      position: "second" as const,
      isWinner: true,
      isDefeated: false,
      expectedOpacity: 1,
    },
  ])(
    "turns reduced $position-card motion into immediate semantic feedback",
    ({ position, isWinner, isDefeated, expectedOpacity }) => {
      expect(
        createNativeValueChoiceMotion({
          position,
          isWinner,
          isDefeated,
          shouldReduceMotion: true,
        }),
      ).toEqual({
        durationMilliseconds: 0,
        opacity: expectedOpacity,
        scale: 1,
        translateY: 0,
      })
    },
  )
})

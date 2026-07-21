import { describe, expect, it } from "vitest"
import { createValueChoiceMotion } from "@/components/ValueChoiceMotion"

describe("createValueChoiceMotion", () => {
  it("preserves the established first-card entry and winner choreography", () => {
    expect(
      createValueChoiceMotion({
        isFirst: true,
        isWinner: true,
        isDefeated: false,
        isAnimating: true,
      }),
    ).toEqual({
      initial: { x: "-100%", opacity: 0 },
      animate: {
        x: 0,
        opacity: 1,
        scale: 1.05,
        filter: "grayscale(0%)",
        y: 0,
      },
      exit: { opacity: 0, scale: 0.8 },
      transition: { type: "spring", stiffness: 300, damping: 25 },
    })
  })

  it("preserves the established second-card defeated choreography", () => {
    expect(
      createValueChoiceMotion({
        isFirst: false,
        isWinner: false,
        isDefeated: true,
        isAnimating: true,
      }).animate,
    ).toEqual({
      x: 0,
      opacity: 0.3,
      scale: 0.9,
      filter: "grayscale(100%)",
      y: 100,
    })
  })
})

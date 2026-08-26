import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import MapacheScreen from "@/components/MapacheScreen"

const SAFE_AREA_EDGE_CLASS_NAMES = Object.freeze([
  "pt-[max(var(--mapache-screen-spacing),env(safe-area-inset-top,0px))]",
  "pr-[max(var(--mapache-screen-spacing),env(safe-area-inset-right,0px))]",
  "pb-[max(var(--mapache-screen-spacing),env(safe-area-inset-bottom,0px))]",
  "pl-[max(var(--mapache-screen-spacing),env(safe-area-inset-left,0px))]",
] as const)

describe("MapacheScreen", () => {
  it("defaults to a scrollable standard-spaced safe-area screen", () => {
    render(<MapacheScreen aria-label="Values screen" />)

    const valuesScreen = screen.getByRole("main", { name: "Values screen" })
    expect(valuesScreen).toHaveAttribute("data-slot", "mapache-screen")
    expect(valuesScreen).toHaveClass(
      "noise-bg",
      "bg-mapache-vivid-dark",
      "w-full",
      "min-h-[100dvh]",
      "[--mapache-screen-spacing:1rem]",
      "sm:[--mapache-screen-spacing:2rem]",
      ...SAFE_AREA_EDGE_CLASS_NAMES,
    )
  })

  it("supports a fixed viewport with safe-area-only spacing", () => {
    render(
      <MapacheScreen
        aria-label="Battle screen"
        className="flex"
        spacing="safe-area-only"
        viewport="fixed"
      />,
    )

    const battleScreen = screen.getByRole("main", { name: "Battle screen" })
    expect(battleScreen).toHaveClass(
      "flex",
      "h-[100dvh]",
      "overflow-hidden",
      "[--mapache-screen-spacing:0px]",
    )
    expect(battleScreen).not.toHaveClass("min-h-[100dvh]")
  })

  it("preserves compact and xl-responsive spacing contracts", () => {
    render(
      <>
        <MapacheScreen aria-label="Introduction" spacing="compact" />
        <MapacheScreen aria-label="Settings" spacing="standard-xl" />
      </>,
    )

    expect(screen.getByRole("main", { name: "Introduction" })).toHaveClass(
      "[--mapache-screen-spacing:1rem]",
      "sm:[--mapache-screen-spacing:1.5rem]",
    )
    expect(screen.getByRole("main", { name: "Settings" })).toHaveClass(
      "[--mapache-screen-spacing:1rem]",
      "xl:[--mapache-screen-spacing:2rem]",
    )
  })
})

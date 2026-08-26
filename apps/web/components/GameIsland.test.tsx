import { introductionCopy } from "@game/data/src/IntroductionCopy"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import GameIsland from "@/components/GameIsland"

const { dynamicGameClientLoader } = vi.hoisted(() => ({
  dynamicGameClientLoader: vi.fn<() => Promise<unknown>>(),
}))

vi.mock("@/components/GameClient", () => ({
  default: () => null,
}))

vi.mock("next/dynamic", () => ({
  default: (
    loader: () => Promise<unknown>,
    { loading: Loading }: { readonly loading: () => ReactNode },
  ) => {
    dynamicGameClientLoader.mockImplementation(loader)
    return Loading
  },
}))

describe("GameIsland", () => {
  it("reserves a named viewport for the accessible static fallback", () => {
    render(<GameIsland />)

    expect(
      screen.getByRole("region", {
        name: `Play ${introductionCopy.title}`,
      }),
    ).toHaveClass("min-h-[100dvh]")
    expect(screen.getByRole("main", { name: "Loading game" })).toHaveClass(
      "h-[100dvh]",
      "grid",
      "place-items-center",
    )
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: introductionCopy.title,
      }),
    ).toBeVisible()
    expect(screen.getByText(introductionCopy.tagline)).toBeVisible()
    expect(screen.getByRole("status")).toHaveTextContent("Loading game…")
    expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true")
  })

  it("gives JavaScript-disabled visitors a static Introduction route", () => {
    const staticMarkup = renderToStaticMarkup(<GameIsland />)

    expect(staticMarkup).toContain('<noscript><a href="#introduction"')
    expect(staticMarkup).toContain("Read the Introduction</a></noscript>")
  })

  it("loads the canonical game client through the isolated boundary", async () => {
    await expect(dynamicGameClientLoader()).resolves.toHaveProperty("default")
  })
})

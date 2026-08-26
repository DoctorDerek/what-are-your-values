import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Page from "./page"

vi.mock("@/components/GameIsland", () => ({
  default: function GameIsland() {
    return <section aria-label="Game island">Game island</section>
  },
}))

describe("web page", () => {
  it("composes the static English article after the client-only game island", () => {
    render(<Page />)

    const gameIsland = screen.getByRole("region", { name: "Game island" })
    const editorialArticle = screen.getByRole("article", {
      name: "What Are Your Values, Mapache? information",
    })
    const editorialQueries = within(editorialArticle)

    expect(gameIsland.compareDocumentPosition(editorialArticle)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(
      editorialQueries.getByRole("link", { name: "Start or Continue Game" }),
    ).toHaveAttribute("href", "#game")
    expect(
      editorialQueries.getByRole("heading", {
        level: 2,
        name: "Introduction",
      }),
    ).toBeVisible()
    expect(editorialQueries.getAllByRole("term")).toHaveLength(100)
    expect(
      editorialQueries.getByRole("link", { name: "Report a Problem" }),
    ).toHaveAttribute("href", "mailto:derekraustin+wayvm@gmail.com")
  })
})

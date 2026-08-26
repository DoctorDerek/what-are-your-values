import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Page from "./page"

vi.mock("@/components/GameIsland", () => ({
  default: function GameIsland() {
    return <div>Game island</div>
  },
}))

describe("web page", () => {
  it("composes the client-only game island from the server page", () => {
    render(<Page />)

    expect(screen.getByText("Game island")).toBeVisible()
  })
})

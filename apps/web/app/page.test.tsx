import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Page from "./page"

vi.mock("next/dynamic", () => ({
  default: () =>
    function DynamicGameClient() {
      return <div>Game client</div>
    },
}))

describe("web page", () => {
  it("composes the client-only game entry point", () => {
    render(<Page />)

    expect(screen.getByText("Game client")).toBeVisible()
  })
})

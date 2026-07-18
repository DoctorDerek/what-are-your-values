import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { webStorage } from "@/lib/WebStorage"
import GameClient from "./GameClient"

describe("GameClient Integration", () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("carries one canonical battle result back to the earned Hub ranking", async () => {
    const getItem = vi
      .spyOn(webStorage, "getItem")
      .mockReturnValue("returning-player")
    const setItem = vi.spyOn(webStorage, "setItem")
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000041",
    )

    render(<GameClient />)

    expect(
      await screen.findByText("Keep comparing values to reveal your Top Five."),
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Battle" }))

    const winnerIndicator = await screen.findByText("[1 / A]")
    const winnerCard = winnerIndicator.closest("div")
    const winnerName = winnerCard?.querySelector("h2")?.textContent
    if (!winnerCard || !winnerName) {
      throw new Error("The projected winner card is unavailable")
    }

    fireEvent.click(winnerCard)
    fireEvent.click(winnerCard)
    fireEvent.click(screen.getByRole("button", { name: /Stop/ }))

    expect(await screen.findByText(`#1 ${winnerName}`)).toBeVisible()
    expect(screen.getByText("LVL 2")).toBeVisible()
    expect(getItem).toHaveBeenCalledTimes(1)
    expect(getItem).toHaveBeenCalledWith("wayvm_uuid")
    expect(setItem).not.toHaveBeenCalled()
  })

  it("persists a first-run profile only after introduction completion", async () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000042")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000043")

    render(<GameClient />)

    expect(
      await screen.findByRole("heading", {
        name: "What Are Your Values, Mapache?",
      }),
    ).toBeVisible()
    expect(localStorage.getItem("wayvm_uuid")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Start" }))

    expect(await screen.findByText("Sovereign Dashboard")).toBeVisible()
    expect(localStorage.getItem("wayvm_uuid")).toBe(
      "00000000-0000-4000-8000-000000000043",
    )
  })
})

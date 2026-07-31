import type { DurableStoreTransaction } from "@game/machines/src/DurableStoreAdapter"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { webStorage } from "@/lib/WebStorage"
import GameClient from "./GameClient"

const durableStoreFailure = vi.hoisted(() => ({
  readEnabled: false,
  writeEnabled: false,
}))

vi.mock("@/lib/IndexedDbDurableStore", async () => {
  const { createInMemoryDurableStore } =
    await import("@game/machines/src/InMemoryDurableStore")

  return {
    createIndexedDbDurableStore: () => {
      const durableStore = createInMemoryDurableStore()

      return {
        readAll: async () => {
          if (durableStoreFailure.readEnabled) {
            throw new Error("IndexedDB unavailable")
          }

          return durableStore.readAll()
        },
        compareAndSwapVerified: async (
          transaction: DurableStoreTransaction,
        ) => {
          if (durableStoreFailure.writeEnabled) {
            throw new Error("IndexedDB write failed")
          }

          return durableStore.compareAndSwapVerified(transaction)
        },
      }
    },
  }
})

describe("GameClient Integration", () => {
  afterEach(() => {
    durableStoreFailure.readEnabled = false
    durableStoreFailure.writeEnabled = false
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("renders the safe persistence failure screen without exposing saved data", async () => {
    durableStoreFailure.readEnabled = true

    render(<GameClient />)

    expect(
      await screen.findByRole("heading", {
        name: "We couldn’t safely load your values.",
      }),
    ).toBeVisible()
    expect(
      screen.getByText(
        "Your saved data was left unchanged. Reload this page to try again.",
      ),
    ).toBeVisible()
  })

  it("preserves a Custom Value draft after a failed write and commits it on retry", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000047",
    )

    render(<GameClient />)

    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Custom Value" }),
    )
    fireEvent.change(await screen.findByLabelText("Value Name"), {
      target: { value: "Ingenuity" },
    })
    fireEvent.change(screen.getByLabelText("What This Value Means to Me"), {
      target: { value: "To make original solutions." },
    })

    durableStoreFailure.writeEnabled = true
    fireEvent.click(screen.getByRole("button", { name: "Save Value" }))

    expect(
      await screen.findByRole("alert", {
        name: "Custom Value save failed",
      }),
    ).toBeVisible()
    expect(screen.getByText("100 Active Values")).toBeVisible()
    expect(screen.getByLabelText("Value Name")).toHaveValue("Ingenuity")
    expect(screen.getByLabelText("What This Value Means to Me")).toHaveValue(
      "To make original solutions.",
    )
    expect(screen.getByRole("button", { name: "Save Value" })).toBeEnabled()

    durableStoreFailure.writeEnabled = false
    fireEvent.click(screen.getByRole("button", { name: "Save Value" }))

    expect(await screen.findByText("101 Active Values")).toBeVisible()
    expect(
      screen.queryByRole("alert", { name: "Custom Value save failed" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("form", { name: "Add Custom Value" }),
    ).not.toBeInTheDocument()
  })

  it("carries one canonical battle result back to the earned Hub ranking", async () => {
    const setItem = vi.spyOn(webStorage, "setItem")
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000041",
    )

    render(<GameClient />)

    expect(await screen.findByRole("button", { name: "Start" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Start" }))

    expect(
      await screen.findByText(
        "Not ranked yet. Browse the included values, then battle when you are ready.",
      ),
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Battle" }))

    const winnerIndicator = await screen.findByText("[1 / A]")
    const winnerCard = winnerIndicator.closest("button")
    const winnerName = winnerCard?.querySelector("h2")?.textContent
    if (!winnerCard || !winnerName) {
      throw new Error("The projected winner card is unavailable")
    }

    fireEvent.click(winnerCard)
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole("button", { name: /Stop/ }))

    expect(
      await screen.findByRole("heading", { name: "Top Five" }),
    ).toBeVisible()
    expect(
      screen.getByRole("button", {
        name: `Open ${winnerName} in All Values`,
      }),
    ).toBeVisible()
    expect(screen.getByText("Level 2")).toBeVisible()
    expect(setItem).not.toHaveBeenCalled()
  })

  it("routes app-level Undo and Redo actions through the durable history", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000043",
    )

    render(<GameClient />)

    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(await screen.findByRole("button", { name: "Battle" }))

    const winnerCard = (await screen.findByText("[1 / A]")).closest("button")
    if (!winnerCard) {
      throw new Error("The projected winner card is unavailable")
    }
    fireEvent.click(winnerCard)

    const undoButton = await screen.findByRole("button", { name: "Undo" })
    await waitFor(() => expect(undoButton).toBeEnabled())
    fireEvent.click(undoButton)

    const redoButton = screen.getByRole("button", { name: "Redo" })
    await waitFor(() => expect(redoButton).toBeEnabled())
    fireEvent.click(redoButton)

    await waitFor(() => expect(redoButton).toBeDisabled())
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
  })

  it("persists a first-run profile only after introduction completion", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000042",
    )

    render(<GameClient />)

    expect(
      await screen.findByRole("heading", {
        name: "What Are Your Values, Mapache?",
      }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Start" }))

    expect(
      await screen.findByRole("heading", { name: "Your Values", level: 1 }),
    ).toBeVisible()
  })

  it("opens the complete All Values ranking and returns to the unchanged Hub", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000044",
    )

    render(<GameClient />)

    expect(await screen.findByRole("button", { name: "Start" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Start" }))

    expect(
      await screen.findByText(
        "Not ranked yet. Browse the included values, then battle when you are ready.",
      ),
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Browse All Values" }))

    expect(
      await screen.findByRole("heading", { name: "All Values", level: 1 }),
    ).toBeVisible()
    expect(screen.getByText("100 Active Values")).toBeVisible()
    expect(screen.getAllByRole("listitem")).toHaveLength(100)

    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    expect(
      await screen.findByRole("heading", { name: "Your Values", level: 1 }),
    ).toBeVisible()
    expect(
      screen.getByText(
        "Not ranked yet. Browse the included values, then battle when you are ready.",
      ),
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Browse All Values" }),
    ).toHaveFocus()
  })

  it("opens a specific Hub value in All Values and restores focus on return", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000046",
    )

    render(<GameClient />)

    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Open Acceptance in All Values",
      }),
    )

    expect(
      await screen.findByRole("heading", { name: "All Values", level: 1 }),
    ).toBeVisible()
    expect(screen.getByText("Acceptance").closest("li")).toHaveClass("ring-8")

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(
      await screen.findByRole("heading", { name: "Your Values", level: 1 }),
    ).toBeVisible()
    expect(
      screen.getByRole("button", {
        name: "Open Acceptance in All Values",
      }),
    ).toHaveFocus()
  })

  it("adds, edits, and deletes a Custom Value without resetting retained rankings", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000045",
    )

    render(<GameClient />)

    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Add Custom Value" }),
    )

    fireEvent.change(await screen.findByLabelText("Value Name"), {
      target: { value: "Ingenuity" },
    })
    fireEvent.change(screen.getByLabelText("What This Value Means to Me"), {
      target: { value: "To make original solutions." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Value" }))

    const customValueRow = await waitFor(() => {
      const valueText = screen
        .getAllByText("Ingenuity")
        .find((element) => element.closest("li"))
      const valueRow = valueText?.closest("li")
      if (!valueRow) {
        throw new Error("The added Custom Value row is unavailable")
      }
      return valueRow
    })
    expect(
      screen.queryByRole("form", { name: "Add Custom Value" }),
    ).not.toBeInTheDocument()
    fireEvent.click(
      within(customValueRow).getByRole("button", { name: "Edit" }),
    )
    fireEvent.change(screen.getByLabelText("Value Name"), {
      target: { value: "Curiosity Engine" },
    })
    fireEvent.change(screen.getByLabelText("What This Value Means to Me"), {
      target: { value: "To explore how things connect." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Review Update" }))
    fireEvent.click(screen.getByRole("button", { name: "Update Value" }))

    const updatedValueRow = await waitFor(() => {
      const valueText = screen
        .getAllByText("Curiosity Engine")
        .find((element) => element.closest("li"))
      const valueRow = valueText?.closest("li")
      if (!valueRow) {
        throw new Error("The updated Custom Value row is unavailable")
      }
      return valueRow
    })
    expect(
      screen.queryByRole("alertdialog", { name: "Update Ingenuity?" }),
    ).not.toBeInTheDocument()
    fireEvent.click(
      within(updatedValueRow).getByRole("button", { name: "Delete" }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Delete Value" }))

    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(100),
    )
    expect(screen.getByText("100 Active Values")).toBeVisible()
  })
})

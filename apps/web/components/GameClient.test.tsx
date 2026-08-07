import { createInitialAchievementState } from "@game/machines/src/AchievementState"
import { createCustomValueAddCommit } from "@game/machines/src/CustomValueCommands"
import type { DurableStoreTransaction } from "@game/machines/src/DurableStoreAdapter"
import {
  createInitialPlayerData,
  createPlayerData,
} from "@game/machines/src/PlayerData"
import { playerDataPortabilityCopy } from "@game/machines/src/PlayerDataPortabilityCopy"
import {
  createWayvmExport,
  serializeWayvmExport,
} from "@game/machines/src/WayvmExport"
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
    expect(screen.getByText("Level 3")).toBeVisible()
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

  it("downloads a private JSON backup and restores Hub focus after closing", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000048",
    )
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:game-client-backup")
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined)

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Import & Export" }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Export Data" }))

    expect(
      await screen.findByText(playerDataPortabilityCopy.exportSuccess),
    ).toBeVisible()
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:game-client-backup")

    fireEvent.click(screen.getByRole("button", { name: "Back to Your Values" }))
    expect(
      await screen.findByRole("heading", { name: "Your Values", level: 1 }),
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Import & Export" }),
    ).toHaveFocus()
  })

  it("previews and restores a complete local backup before returning to Hub", async () => {
    const createdAt = "2026-08-06T12:00:00.000Z"
    const initialPlayerData = createInitialPlayerData({
      schedulerSeed: "imported-game-client-seed",
      createdAt,
    })
    const customValueCommit = createCustomValueAddCommit({
      profile: initialPlayerData.profile,
      name: "Ingenuity",
      definition: "To make original solutions.",
      now: () => createdAt,
      randomUuid: () => "00000000-0000-4000-8000-000000000049",
    })
    const importedPlayerData = createPlayerData({
      ...initialPlayerData,
      profile: customValueCommit.profile,
      achievements: createInitialAchievementState(
        customValueCommit.profile.activeDeck,
      ),
    })
    const wayvmExport = await createWayvmExport({
      exportedAt: createdAt,
      sourceAppVersion: "5.2.0",
      sourceBuild: "portable-build-49",
      playerData: importedPlayerData,
    })
    const backupFile = new File(
      [serializeWayvmExport(wayvmExport)],
      "wayvm-backup.json",
      { type: "application/json" },
    )
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000050",
    )

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Import & Export" }),
    )
    fireEvent.change(screen.getByLabelText("Choose WAYVM JSON backup"), {
      target: { files: [backupFile] },
    })

    expect(
      await screen.findByRole("heading", { name: "Review Import" }),
    ).toBeVisible()
    expect(screen.getByText("portable-build-49")).toBeVisible()
    expect(screen.queryByText("Ingenuity")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(
      await screen.findByText(playerDataPortabilityCopy.importCancelled),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Choose Backup" })).toHaveFocus()
    expect(screen.queryByText("Ingenuity")).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Choose WAYVM JSON backup"), {
      target: { files: [backupFile] },
    })
    expect(
      await screen.findByRole("heading", { name: "Review Import" }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Import & Replace" }))

    expect(
      await screen.findByText(playerDataPortabilityCopy.importSuccess),
    ).toBeVisible()
    expect(
      screen.getByRole("button", {
        name: "Open Ingenuity in All Values",
      }),
    ).toBeVisible()
    expect(screen.getAllByRole("listitem")).toHaveLength(101)
    expect(
      screen.getByRole("button", { name: "Import & Export" }),
    ).toHaveFocus()
  })

  it("reports browser backup delivery failure without leaving private bytes pending", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000051",
    )
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("Browser download failed")
    })

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Import & Export" }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Export Data" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      playerDataPortabilityCopy.exportFailure,
    )
    expect(screen.getByRole("button", { name: "Export Data" })).toBeEnabled()
  })

  it("rejects an invalid selected backup and preserves the current Hub values", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000052",
    )
    const invalidBackup = new File(["{}"], "invalid-wayvm-backup.json", {
      type: "application/json",
    })

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Import & Export" }),
    )
    fireEvent.change(screen.getByLabelText("Choose WAYVM JSON backup"), {
      target: { files: [invalidBackup] },
    })

    const issue = await screen.findByRole("alert")
    expect(issue).toHaveTextContent(playerDataPortabilityCopy.importInvalid)
    expect(issue).toHaveFocus()
    expect(screen.getByRole("button", { name: "Choose Backup" })).toBeEnabled()

    fireEvent.click(screen.getByRole("button", { name: "Back to Your Values" }))
    expect(await screen.findAllByRole("listitem")).toHaveLength(100)
  })

  it("normalizes an unreadable browser file and keeps backup selection retryable", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000053",
    )
    const unreadableBackup = new File(
      ['["wayvm-export"]'],
      "unreadable-wayvm-backup.json",
      { type: "application/json" },
    )
    vi.spyOn(unreadableBackup, "text").mockRejectedValue(
      new Error("Browser file access failed"),
    )

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Import & Export" }),
    )
    fireEvent.change(screen.getByLabelText("Choose WAYVM JSON backup"), {
      target: { files: [unreadableBackup] },
    })

    const issue = await screen.findByRole("alert")
    expect(issue).toHaveTextContent(playerDataPortabilityCopy.importInvalid)
    expect(issue).toHaveFocus()
    expect(screen.getByRole("button", { name: "Choose Backup" })).toBeEnabled()
  })
})

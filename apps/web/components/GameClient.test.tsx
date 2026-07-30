import {
  BATTLE_PROFILE_MANIFEST_KEY,
  BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
} from "@game/machines/src/BattleProfileStore"
import type {
  DurableStoreEntry,
  DurableStoreTransaction,
} from "@game/machines/src/DurableStoreAdapter"
import { createInitialPlayerData } from "@game/machines/src/PlayerData"
import type { PreparedWayvmDownload } from "@game/machines/src/PlayerDataPortabilityActors"
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
  initialEntries: [] as DurableStoreEntry[],
  readEnabled: false,
  writeEnabled: false,
}))
const playerDataFileSpies = vi.hoisted(() => ({
  download: vi.fn<(download: PreparedWayvmDownload) => void>(),
}))

vi.mock("@/lib/IndexedDbDurableStore", async () => {
  const { createInMemoryDurableStore } =
    await import("@game/machines/src/InMemoryDurableStore")

  return {
    createIndexedDbDurableStore: () => {
      const durableStore = createInMemoryDurableStore(
        durableStoreFailure.initialEntries,
      )

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

vi.mock("@/lib/PlayerDataFiles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/PlayerDataFiles")>()

  return {
    ...actual,
    downloadPlayerDataFile: playerDataFileSpies.download,
  }
})

describe("GameClient Integration", () => {
  afterEach(() => {
    durableStoreFailure.initialEntries = []
    durableStoreFailure.readEnabled = false
    durableStoreFailure.writeEnabled = false
    playerDataFileSpies.download.mockReset()
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
        "Your saved data was left unchanged. Try again after checking that this browser can access local storage.",
      ),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Try Again" })).toBeVisible()
  })

  it("exports captured corruption and restores the retained last-known-good save through validated review", async () => {
    const retainedPlayerData = createInitialPlayerData({
      schedulerSeed: "game-client-retained-recovery",
      createdAt: "2026-07-29T12:34:56.000Z",
    })
    const serializedBackup = serializeWayvmExport(
      await createWayvmExport({
        exportedAt: "2026-07-29T12:34:56.000Z",
        sourceAppVersion: "0.1.0",
        sourceBuild: "retained-game-client-build",
        playerData: retainedPlayerData,
      }),
    )
    durableStoreFailure.initialEntries = [
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      [BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY, serializedBackup],
    ]

    render(<GameClient />)

    expect(
      await screen.findByRole("heading", {
        name: "Your Saved Data Needs Attention",
      }),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole("button", { name: "Export Unreadable Data" }),
    )
    await waitFor(() =>
      expect(playerDataFileSpies.download).toHaveBeenCalledOnce(),
    )
    expect(playerDataFileSpies.download.mock.calls[0]?.[0]).toMatchObject({
      filename: expect.stringContaining("mapache-recovery"),
      serialized: expect.stringContaining("corrupt-checkpoint"),
    })

    fireEvent.click(
      screen.getByRole("button", {
        name: "Restore Last Known-Good Save",
      }),
    )
    expect(
      await screen.findByRole("heading", { name: "Review Import" }),
    ).toBeVisible()
    expect(
      screen.getByText(
        "Restore the last known-good save? The unreadable current save will be preserved until restoration succeeds.",
      ),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole("button", {
        name: "Restore Last Known-Good Save",
      }),
    )

    expect(
      await screen.findByText("Last known-good save restored."),
    ).toHaveAttribute("role", "status")
    expect(
      screen.getByRole("heading", { name: "Your Values", level: 1 }),
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
    fireEvent.change(await screen.findByLabelText("Custom Value Name"), {
      target: { value: "Ingenuity" },
    })
    fireEvent.change(screen.getByLabelText("Personal Definition"), {
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
    expect(screen.getByLabelText("Custom Value Name")).toHaveValue("Ingenuity")
    expect(screen.getByLabelText("Personal Definition")).toHaveValue(
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
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Achievement unlocked: First Battle.",
    )
    fireEvent.click(screen.getByRole("button", { name: "Dismiss achievement" }))
    await waitFor(() =>
      expect(
        screen.queryByRole("complementary", {
          name: "Achievement unlocked",
        }),
      ).not.toBeInTheDocument(),
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

  it("opens the complete local Achievements catalog and restores Hub focus on return", async () => {
    render(<GameClient />)

    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    const achievementsButton = await screen.findByRole("button", {
      name: "Achievements",
    })
    fireEvent.click(achievementsButton)

    expect(
      await screen.findByRole("heading", {
        name: "Achievements",
        level: 1,
      }),
    ).toBeVisible()
    expect(screen.getAllByRole("listitem")).toHaveLength(109)
    fireEvent.click(screen.getByRole("button", { name: "Back to Your Values" }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Achievements" }),
      ).toHaveFocus(),
    )
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

  it("exports previews cancels and atomically imports complete local Player Data before restoring Hub focus", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000053",
    )

    render(<GameClient />)

    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(await screen.findByRole("button", { name: "Manage Data" }))
    fireEvent.click(screen.getByRole("button", { name: "Export Data" }))

    await waitFor(() =>
      expect(playerDataFileSpies.download).toHaveBeenCalledOnce(),
    )
    expect(
      await screen.findByText("Your private backup is ready."),
    ).toBeVisible()
    const preparedDownload = playerDataFileSpies.download.mock.calls[0]?.[0]
    if (!preparedDownload) {
      throw new Error("The complete backup download was not prepared")
    }
    const backupFile = new File(
      [preparedDownload.serialized],
      preparedDownload.filename,
      { type: "application/json" },
    )

    fireEvent.change(screen.getByLabelText("Import Data"), {
      target: { files: [backupFile] },
    })
    expect(
      await screen.findByRole("heading", { name: "Review Import" }),
    ).toBeVisible()
    expect(screen.getByText("100 active · 0 custom")).toBeVisible()
    expect(
      screen.getByText(/Version 0\.1\.0 · Build development/),
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Cancel Import" }))
    expect(
      await screen.findByRole("heading", { name: "Private Backups" }),
    ).toBeVisible()

    fireEvent.change(screen.getByLabelText("Import Data"), {
      target: { files: [backupFile] },
    })
    fireEvent.click(
      await screen.findByRole("button", { name: "Replace Current Data" }),
    )

    expect(
      await screen.findByText(
        "Your imported values and progress are now active.",
      ),
    ).toBeVisible()
    expect(playerDataFileSpies.download).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole("button", { name: "Back to Your Values" }))
    const manageDataButton = await screen.findByRole("button", {
      name: "Manage Data",
    })
    await waitFor(() => expect(manageDataButton).toHaveFocus())
  })

  it("reports invalid import bytes without leaving Data Management or replacing current values", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000054",
    )

    render(<GameClient />)

    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(await screen.findByRole("button", { name: "Manage Data" }))
    fireEvent.change(screen.getByLabelText("Import Data"), {
      target: {
        files: [
          new File(["{}"], "invalid-backup.json", {
            type: "application/json",
          }),
        ],
      },
    })

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Persisted JSON must use tuple arrays rather than objects",
    )
    expect(
      screen.getByRole("heading", { name: "Private Backups" }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Back to Your Values" }))
    expect(
      await screen.findByRole("heading", { name: "Included Values" }),
    ).toBeVisible()
  })

  it("returns an earned ranking to the all-tied Hub through the reviewed levels-and-experience reset", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000055",
    )

    render(<GameClient />)

    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(await screen.findByRole("button", { name: "Battle" }))
    const winnerCard = (await screen.findByText("[1 / A]")).closest("button")
    if (!winnerCard) {
      throw new Error("Progress reset winner card is unavailable")
    }
    fireEvent.click(winnerCard)
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole("button", { name: /Stop/ }))
    expect(
      await screen.findByRole("heading", { name: "Top Five" }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Manage Data" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Reset Levels & Experience" }),
    )
    expect(
      screen.getByRole("heading", { name: "Reset Levels & Experience?" }),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole("button", { name: "Reset Levels & Experience" }),
    )

    expect(
      await screen.findByText(
        "Levels and experience were reset. Custom Values, achievements, and settings were kept.",
      ),
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Back to Your Values" }))

    expect(
      await screen.findByRole("heading", { name: "Included Values" }),
    ).toBeVisible()
    expect(screen.queryByRole("heading", { name: "Top Five" })).toBeNull()
    expect(screen.getAllByText("Level 1").length).toBeGreaterThan(0)
  })

  it("requires acknowledgment before deleting all local data and returns through a fresh Introduction", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000056",
    )

    render(<GameClient />)

    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(await screen.findByRole("button", { name: "Manage Data" }))
    fireEvent.click(screen.getByRole("button", { name: "Delete All Data" }))
    const deleteButton = screen.getByRole("button", {
      name: "Delete All Data",
    })
    expect(deleteButton).toBeDisabled()

    fireEvent.click(
      screen.getByLabelText("I understand that this cannot be undone."),
    )
    fireEvent.click(deleteButton)

    expect(
      await screen.findByText("All local WAYVM player data was deleted."),
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Start" }))

    expect(
      await screen.findByRole("heading", { name: "Included Values" }),
    ).toBeVisible()
    expect(screen.getAllByRole("listitem")).toHaveLength(100)
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

    fireEvent.change(await screen.findByLabelText("Custom Value Name"), {
      target: { value: "Ingenuity" },
    })
    fireEvent.change(screen.getByLabelText("Personal Definition"), {
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
    fireEvent.change(screen.getByLabelText("Custom Value Name"), {
      target: { value: "Curiosity Engine" },
    })
    fireEvent.change(screen.getByLabelText("Personal Definition"), {
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

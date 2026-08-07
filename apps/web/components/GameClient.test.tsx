import { createInitialAchievementState } from "@game/machines/src/AchievementState"
import {
  BATTLE_PROFILE_MANIFEST_KEY,
  BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
} from "@game/machines/src/BattleProfileStore"
import { createCustomValueAddCommit } from "@game/machines/src/CustomValueCommands"
import type { DurableStoreTransaction } from "@game/machines/src/DurableStoreAdapter"
import {
  createInitialPlayerData,
  createPlayerData,
} from "@game/machines/src/PlayerData"
import { playerDataPortabilityCopy } from "@game/machines/src/PlayerDataPortabilityCopy"
import { DELETE_ALL_DATA_ACKNOWLEDGMENT } from "@game/machines/src/PlayerDataReset"
import { playerDataResetCopy } from "@game/machines/src/PlayerDataResetCopy"
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
  initialEntries: [] as [string, string][],
  readEnabled: false,
  writeEnabled: false,
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

async function createSerializedGameClientBackup({
  schedulerSeed,
  sourceBuild,
}: {
  schedulerSeed: string
  sourceBuild: string
}) {
  const createdAt = "2026-08-07T12:00:00.000Z"
  const wayvmExport = await createWayvmExport({
    exportedAt: createdAt,
    sourceAppVersion: "5.2.0",
    sourceBuild,
    playerData: createInitialPlayerData({ schedulerSeed, createdAt }),
  })

  return serializeWayvmExport(wayvmExport)
}

describe("GameClient Integration", () => {
  afterEach(() => {
    durableStoreFailure.initialEntries = []
    durableStoreFailure.readEnabled = false
    durableStoreFailure.writeEnabled = false
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("limits a loading-origin storage failure to retry without inventing player data", async () => {
    durableStoreFailure.readEnabled = true

    render(<GameClient />)

    expect(
      await screen.findByRole("heading", {
        name: "Progress Cannot Be Saved Reliably",
      }),
    ).toBeVisible()
    expect(
      screen.getByText(/Continuing without a reliable save could lose/),
    ).toBeVisible()
    expect(screen.getByRole("alert")).toHaveTextContent("IndexedDB unavailable")
    expect(screen.getByRole("button", { name: "Try Again" })).toBeEnabled()
    expect(
      screen.queryByRole("button", { name: "Export Current Data" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Return Without New Changes" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Delete All Data" }),
    ).not.toBeInTheDocument()

    durableStoreFailure.readEnabled = false
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }))
    expect(
      await screen.findByRole("heading", {
        name: "What Are Your Values, Mapache?",
      }),
    ).toBeVisible()
  })

  it("downloads captured unreadable records without claiming they were erased", async () => {
    durableStoreFailure.initialEntries = [
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
    ]
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:unreadable-wayvm-data")
    const revokeObjectURL = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined)

    render(<GameClient />)

    expect(
      await screen.findByRole("heading", {
        name: "Your Saved Data Needs Attention",
      }),
    ).toBeVisible()
    expect(screen.getByText(/Nothing has been erased\./)).toBeVisible()
    expect(
      screen.getByText(/No last known-good save is available\./),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole("button", { name: "Export Unreadable Data" }),
    )

    expect(
      await screen.findByText(
        "Your unreadable local data is ready as a diagnostic recovery file.",
      ),
    ).toBeVisible()
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith(
      "blob:unreadable-wayvm-data",
    )
    expect(screen.getByText(/Nothing has been erased\./)).toBeVisible()
  })

  it("deletes captured unreadable records only after exact complete-erasure acknowledgment", async () => {
    durableStoreFailure.initialEntries = [
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
    ]
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000111",
    )

    render(<GameClient />)

    fireEvent.click(
      await screen.findByRole("button", { name: "Delete All Data" }),
    )
    expect(
      await screen.findByRole("heading", { name: "Delete All Data?" }),
    ).toBeVisible()
    const deleteAllDataButton = screen.getByRole("button", {
      name: "Delete All Data",
    })
    expect(deleteAllDataButton).toBeDisabled()
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: DELETE_ALL_DATA_ACKNOWLEDGMENT,
      }),
    )
    expect(deleteAllDataButton).toBeEnabled()
    fireEvent.click(deleteAllDataButton)

    expect(
      await screen.findByRole("heading", {
        name: "What Are Your Values, Mapache?",
      }),
    ).toBeVisible()
    expect(
      screen.getByText(
        playerDataResetCopy["delete-all-data"].successAnnouncement,
      ),
    ).toBeVisible()
  })

  it("restores a retained last-known-good save only after validated browser review", async () => {
    const serializedBackup = await createSerializedGameClientBackup({
      schedulerSeed: "known-good-browser-recovery",
      sourceBuild: "known-good-browser-build",
    })
    durableStoreFailure.initialEntries = [
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      [BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY, serializedBackup],
    ]

    render(<GameClient />)

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Restore Last Known-Good Save",
      }),
    )
    expect(
      await screen.findByRole("heading", {
        name: "Restore Last Known-Good Save?",
      }),
    ).toBeVisible()
    expect(screen.getByText("known-good-browser-build")).toBeVisible()
    expect(
      screen.getByText(/unreadable current save will be preserved/),
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Restore Save" }))

    expect(
      await screen.findByRole("heading", { name: "Your Values", level: 1 }),
    ).toBeVisible()
    expect(screen.getByText("Last known-good save restored.")).toBeVisible()
  })

  it("validates and explicitly imports a selected backup over corrupt browser storage", async () => {
    const serializedBackup = await createSerializedGameClientBackup({
      schedulerSeed: "selected-browser-recovery",
      sourceBuild: "selected-browser-build",
    })
    const backupFile = new File(
      [serializedBackup],
      "selected-wayvm-recovery.json",
      { type: "application/json" },
    )
    durableStoreFailure.initialEntries = [
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
    ]

    render(<GameClient />)

    await screen.findByRole("heading", {
      name: "Your Saved Data Needs Attention",
    })
    fireEvent.change(
      screen.getByLabelText("Choose WAYVM JSON backup for recovery"),
      { target: { files: [backupFile] } },
    )
    expect(
      await screen.findByRole("heading", { name: "Review Import" }),
    ).toBeVisible()
    expect(screen.getByText("selected-browser-build")).toBeVisible()
    expect(
      screen.getByText(
        "Import this backup? The unreadable current save will be preserved until replacement succeeds.",
      ),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole("button", { name: "Import & Replace" }),
    )

    expect(
      await screen.findByRole("heading", { name: "Your Values", level: 1 }),
    ).toBeVisible()
    expect(
      screen.getByText("Your backup replaced the unreadable local data."),
    ).toBeVisible()
  })

  it("exports the in-memory profile and returns safely after first-run persistence fails", async () => {
    durableStoreFailure.writeEnabled = true
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000112",
    )
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)
    vi.spyOn(URL, "createObjectURL").mockReturnValue(
      "blob:initialization-recovery",
    )
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))

    expect(
      await screen.findByRole("heading", {
        name: "Progress Cannot Be Saved Reliably",
      }),
    ).toBeVisible()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "IndexedDB write failed",
    )
    expect(
      screen.getByRole("button", { name: "Export Current Data" }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", { name: "Return Without New Changes" }),
    ).toBeEnabled()
    expect(
      screen.queryByRole("button", { name: "Delete All Data" }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: "Export Current Data" }),
    )
    expect(
      await screen.findByText("Your current data backup is ready."),
    ).toBeVisible()
    expect(click).toHaveBeenCalledOnce()
    fireEvent.click(
      screen.getByRole("button", { name: "Return Without New Changes" }),
    )

    expect(
      await screen.findByRole("heading", {
        name: "What Are Your Values, Mapache?",
      }),
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
      screen.queryByText(playerDataPortabilityCopy.importCancelled),
    ).not.toBeInTheDocument()
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

  it("deletes every Custom Value through one exact review without touching canonical values", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000060",
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
    expect(await screen.findByText("101 Active Values")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Import & Export" }),
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Delete All Custom Values" }),
    )
    expect(
      await screen.findByRole("heading", {
        name: "Delete All Custom Values?",
      }),
    ).toBeVisible()
    expect(
      screen.getByText(/The active deck returns to the 100 canonical values/),
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Delete All Custom Values" }),
      ).toHaveFocus(),
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Delete All Custom Values" }),
    )
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Delete All Custom Values",
      }),
    )
    expect(
      await screen.findByText(
        playerDataResetCopy["delete-all-custom-values"].successAnnouncement,
      ),
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Delete All Custom Values" }),
    ).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Back to Your Values" }))
    expect(await screen.findAllByRole("listitem")).toHaveLength(100)
    expect(
      screen.queryByRole("button", {
        name: "Open Ingenuity in All Values",
      }),
    ).not.toBeInTheDocument()
  })

  it("resets played levels and ranking through the durable scoped flow", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000061",
    )

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(await screen.findByRole("button", { name: "Battle" }))
    const winnerCard = (await screen.findByText("[1 / A]")).closest("button")
    if (!winnerCard) throw new Error("The reset test winner is unavailable")
    fireEvent.click(winnerCard)
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole("button", { name: /Stop/ }))
    expect(await screen.findByText("Level 3")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Import & Export" }))

    fireEvent.click(
      screen.getByRole("button", { name: "Reset Levels & Experience" }),
    )
    expect(
      await screen.findByText(/Your current value ranking restarts/),
    ).toBeVisible()
    fireEvent.click(
      screen.getByRole("button", { name: "Reset Levels & Experience" }),
    )
    expect(
      await screen.findByText(
        playerDataResetCopy["reset-levels-and-experience"].successAnnouncement,
      ),
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Back to Your Values" }))
    expect(
      await screen.findByText(
        "Not ranked yet. Browse the included values, then battle when you are ready.",
      ),
    ).toBeVisible()
    expect(screen.queryByRole("heading", { name: "Top Five" })).toBeNull()
    expect(screen.getAllByText("Level 1")).toHaveLength(100)
  })

  it("exports a private backup without dismissing the reviewed reset", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000062",
    )
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined)
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:reset-backup")
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Import & Export" }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Reset Achievements" }))
    expect(
      await screen.findByRole("heading", { name: "Reset Achievements?" }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Export Data" }))

    expect(
      await screen.findByText(
        "Your private backup is ready. Review the reset when you are ready.",
      ),
    ).toBeVisible()
    expect(
      screen.getByRole("heading", { name: "Reset Achievements?" }),
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Reset Achievements" }),
    ).toBeEnabled()
    expect(click).toHaveBeenCalledOnce()
  })

  it("keeps the reviewed reset available after browser backup delivery fails", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000065",
    )
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("Browser download failed")
    })

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Import & Export" }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Reset Achievements" }))
    expect(
      await screen.findByRole("heading", { name: "Reset Achievements?" }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Export Data" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      playerDataPortabilityCopy.exportFailure,
    )
    expect(
      screen.getByRole("heading", { name: "Reset Achievements?" }),
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Reset Achievements" }),
    ).toBeEnabled()
  })

  it("preserves the reviewed reset and current data after a failed write then retries", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000063",
    )

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Import & Export" }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Reset Achievements" }))
    expect(
      await screen.findByRole("heading", { name: "Reset Achievements?" }),
    ).toBeVisible()

    durableStoreFailure.writeEnabled = true
    fireEvent.click(screen.getByRole("button", { name: "Reset Achievements" }))

    const issue = await screen.findByRole("alert")
    expect(issue).toHaveTextContent("IndexedDB write failed")
    expect(issue).toHaveFocus()
    expect(
      screen.getByRole("heading", { name: "Reset Achievements?" }),
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Reset Achievements" }),
    ).toBeEnabled()

    durableStoreFailure.writeEnabled = false
    fireEvent.click(screen.getByRole("button", { name: "Reset Achievements" }))
    expect(
      await screen.findByText(
        playerDataResetCopy["reset-achievements"].successAnnouncement,
      ),
    ).toBeVisible()
  })

  it("requires acknowledgment then deletes all local data and returns to Introduction", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000064",
    )

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Import & Export" }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Delete All Data" }))

    expect(
      await screen.findByRole("heading", { name: "Delete All Data?" }),
    ).toBeVisible()
    const confirmation = screen.getByRole("button", {
      name: "Delete All Data",
    })
    expect(confirmation).toBeDisabled()
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: DELETE_ALL_DATA_ACKNOWLEDGMENT,
      }),
    )
    expect(confirmation).toBeEnabled()
    fireEvent.click(confirmation)

    expect(
      await screen.findByRole("heading", {
        name: "What Are Your Values, Mapache?",
      }),
    ).toBeVisible()
    expect(screen.getByRole("status")).toHaveTextContent(
      playerDataResetCopy["delete-all-data"].successAnnouncement,
    )

    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    expect(
      await screen.findByRole("heading", { name: "Your Values" }),
    ).toBeVisible()
    expect(
      screen.queryByText(
        playerDataResetCopy["delete-all-data"].successAnnouncement,
      ),
    ).not.toBeInTheDocument()
  })
})

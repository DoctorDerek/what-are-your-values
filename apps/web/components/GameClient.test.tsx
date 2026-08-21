import type { ProductMenuDestination } from "@game/data/src/ProductMenu"
import * as AchievementPresentation from "@game/machines/src/AchievementPresentation"
import { createInitialAchievementState } from "@game/machines/src/AchievementState"
import {
  BATTLE_PROFILE_MANIFEST_KEY,
  BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
  initializeBattleProfileStore,
} from "@game/machines/src/BattleProfileStore"
import { createCustomValueAddCommit } from "@game/machines/src/CustomValueCommands"
import type { DurableStoreTransaction } from "@game/machines/src/DurableStoreAdapter"
import { createInMemoryDurableStore } from "@game/machines/src/InMemoryDurableStore"
import {
  createInitialPlayerData,
  createPlayerData,
} from "@game/machines/src/PlayerData"
import { playerDataPortabilityCopy } from "@game/machines/src/PlayerDataPortabilityCopy"
import { DELETE_ALL_DATA_ACKNOWLEDGMENT } from "@game/machines/src/PlayerDataReset"
import { playerDataResetCopy } from "@game/machines/src/PlayerDataResetCopy"
import {
  createWayvmExport,
  decodeWayvmExport,
  serializeWayvmExport,
} from "@game/machines/src/WayvmExport"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { Component, type ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { webStorage } from "@/lib/WebStorage"
import GameClient from "./GameClient"

const durableStoreFailure = vi.hoisted(() => ({
  initialEntries: [] as [string, string][],
  readCount: 0,
  readEnabled: false,
  writeCount: 0,
  writeEnabled: false,
}))

const webExclusiveWriterLease = vi.hoisted(() => ({
  status: "writer" as "checking" | "read-only" | "writer",
}))

vi.mock("@/lib/useWebExclusiveWriterLease", () => ({
  default: () => {
    if (webExclusiveWriterLease.status === "checking")
      return Object.freeze({ status: "checking" as const })
    if (webExclusiveWriterLease.status === "read-only")
      return Object.freeze({
        status: "read-only" as const,
        reason: "lock-unavailable" as const,
      })

    return Object.freeze({
      status: "writer" as const,
      release: () => undefined,
    })
  },
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
          durableStoreFailure.readCount += 1
          if (durableStoreFailure.readEnabled) {
            throw new Error("IndexedDB unavailable")
          }

          return durableStore.readAll()
        },
        compareAndSwapVerified: async (
          transaction: DurableStoreTransaction,
        ) => {
          durableStoreFailure.writeCount += 1
          if (durableStoreFailure.writeEnabled) {
            throw new Error("IndexedDB write failed")
          }

          return durableStore.compareAndSwapVerified(transaction)
        },
      }
    },
  }
})

class InvariantErrorBoundary extends Component<
  Readonly<{ children: ReactNode }>,
  Readonly<{ message: string | null }>
> {
  state: Readonly<{ message: string | null }> = { message: null }

  static getDerivedStateFromError(error: Error) {
    return { message: error.message }
  }

  render() {
    return this.state.message ? (
      <p>{this.state.message}</p>
    ) : (
      this.props.children
    )
  }
}

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

async function createStoredGameClientProfile(schedulerSeed: string) {
  const createdAt = "2026-08-20T12:00:00.000Z"
  const playerData = createInitialPlayerData({ schedulerSeed, createdAt })
  const store = createInMemoryDurableStore()
  await initializeBattleProfileStore({
    store,
    playerData,
    createdAt,
    appVersion: "0.1.0",
  })

  return Object.freeze({
    entries: Array.from(await store.readAll()),
    playerData,
  })
}

async function openProductMenuDestination(
  destinationLabel: ProductMenuDestination["label"],
) {
  fireEvent.click(await screen.findByRole("button", { name: "Menu" }))
  fireEvent.click(await screen.findByRole("button", { name: destinationLabel }))
}

describe("GameClient Integration", () => {
  afterEach(() => {
    durableStoreFailure.initialEntries = []
    durableStoreFailure.readCount = 0
    durableStoreFailure.readEnabled = false
    durableStoreFailure.writeCount = 0
    durableStoreFailure.writeEnabled = false
    webExclusiveWriterLease.status = "writer"
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("keeps storage and game input unavailable while writer ownership is unresolved", () => {
    webExclusiveWriterLease.status = "checking"

    render(<GameClient />)

    expect(screen.getByRole("status")).toHaveTextContent("Loading your values…")
    expect(
      screen.queryByRole("button", { name: "Start" }),
    ).not.toBeInTheDocument()
    expect(durableStoreFailure.readCount).toBe(0)
    expect(durableStoreFailure.writeCount).toBe(0)
  })

  it("keeps a secondary tab read-only and reloads only through Load Latest", async () => {
    webExclusiveWriterLease.status = "read-only"
    const reload = vi
      .spyOn(window.location, "reload")
      .mockImplementation(() => undefined)

    render(<GameClient />)

    expect(
      await screen.findByRole("heading", { name: "Another Tab Is Active" }),
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Start" }),
    ).not.toBeInTheDocument()
    expect(durableStoreFailure.readCount).toBe(0)
    expect(durableStoreFailure.writeCount).toBe(0)

    fireEvent.click(screen.getByRole("button", { name: "Load Latest" }))
    expect(reload).toHaveBeenCalledOnce()
  })

  it("exports validated durable Player Data without mounting the writable game", async () => {
    webExclusiveWriterLease.status = "read-only"
    const storedProfile = await createStoredGameClientProfile(
      "read-only-export-seed",
    )
    durableStoreFailure.initialEntries = storedProfile.entries
    const downloadedBlobs: Blob[] = []
    vi.spyOn(URL, "createObjectURL").mockImplementation((source) => {
      if (!(source instanceof Blob))
        throw new Error("The read-only backup was not a Blob")
      downloadedBlobs.push(source)
      return "blob:read-only-game-client-backup"
    })
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined)
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    )

    render(<GameClient />)
    fireEvent.click(
      await screen.findByRole("button", { name: "Export This Tab" }),
    )

    expect(
      await screen.findByText(playerDataPortabilityCopy.exportSuccess),
    ).toBeVisible()
    const downloadedBlob = downloadedBlobs[0]
    if (!downloadedBlob)
      throw new Error("The read-only backup was not delivered")
    const wayvmExport = await decodeWayvmExport(await downloadedBlob.text())
    expect(wayvmExport.playerData).toEqual(storedProfile.playerData)
    expect(durableStoreFailure.readCount).toBe(1)
    expect(durableStoreFailure.writeCount).toBe(0)
    expect(
      screen.queryByRole("button", { name: "Start" }),
    ).not.toBeInTheDocument()
  })

  it.each([
    {
      condition: "has no saved profile",
      entries: [] as [string, string][],
    },
    {
      condition: "contains damaged profile records",
      entries: [
        [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
        [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      ] as [string, string][],
    },
  ])(
    "reports export failure without mutation when durable storage $condition",
    async ({ entries }) => {
      webExclusiveWriterLease.status = "read-only"
      durableStoreFailure.initialEntries = entries

      render(<GameClient />)
      fireEvent.click(
        await screen.findByRole("button", { name: "Export This Tab" }),
      )

      expect(await screen.findByRole("alert")).toHaveTextContent(
        playerDataPortabilityCopy.exportFailure,
      )
      expect(durableStoreFailure.readCount).toBe(1)
      expect(durableStoreFailure.writeCount).toBe(0)
    },
  )

  it("reports a read-only storage outage without attempting recovery writes", async () => {
    webExclusiveWriterLease.status = "read-only"
    durableStoreFailure.readEnabled = true

    render(<GameClient />)
    fireEvent.click(
      await screen.findByRole("button", { name: "Export This Tab" }),
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(
      playerDataPortabilityCopy.exportFailure,
    )
    expect(durableStoreFailure.readCount).toBe(1)
    expect(durableStoreFailure.writeCount).toBe(0)
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
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:unreadable-wayvm-data")
    expect(screen.getByText(/Nothing has been erased\./)).toBeVisible()
  })

  it("keeps unreadable data recoverable when browser diagnostic delivery fails", async () => {
    durableStoreFailure.initialEntries = [
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
    ]
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("Browser download failed")
    })

    render(<GameClient />)

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Export Unreadable Data",
      }),
    )

    expect(await screen.findByRole("alert")).toHaveTextContent(
      playerDataPortabilityCopy.exportFailure,
    )
    expect(screen.getByText(/Nothing has been erased\./)).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Export Unreadable Data" }),
    ).toBeEnabled()
  })

  it("preserves captured unreadable records when retry encounters a temporary storage outage", async () => {
    durableStoreFailure.initialEntries = [
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
    ]

    render(<GameClient />)

    await screen.findByRole("heading", {
      name: "Your Saved Data Needs Attention",
    })
    durableStoreFailure.readEnabled = true
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "IndexedDB unavailable",
    )
    expect(
      screen.getByRole("heading", {
        name: "Your Saved Data Needs Attention",
      }),
    ).toBeVisible()
    expect(screen.getByText(/Nothing has been erased\./)).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Export Unreadable Data" }),
    ).toBeEnabled()
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
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Delete All Data" }),
      ).toHaveFocus(),
    )
    fireEvent.click(screen.getByRole("button", { name: "Delete All Data" }))
    await screen.findByRole("heading", { name: "Delete All Data?" })
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
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Restore Last Known-Good Save",
        }),
      ).toHaveFocus(),
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Restore Last Known-Good Save" }),
    )
    await screen.findByRole("heading", {
      name: "Restore Last Known-Good Save?",
    })
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
    fireEvent.click(screen.getByRole("button", { name: "Import & Replace" }))

    expect(
      await screen.findByRole("heading", { name: "Your Values", level: 1 }),
    ).toBeVisible()
    expect(
      screen.getByText("Your backup replaced the unreadable local data."),
    ).toBeVisible()
  })

  it("keeps corrupt data recoverable when the browser cannot read a selected backup", async () => {
    durableStoreFailure.initialEntries = [
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
    ]
    const unreadableBackup = new File(
      ['["wayvm-export"]'],
      "unreadable-recovery-backup.json",
      { type: "application/json" },
    )
    vi.spyOn(unreadableBackup, "text").mockRejectedValue(
      new Error("Browser file access failed"),
    )

    render(<GameClient />)

    await screen.findByRole("heading", {
      name: "Your Saved Data Needs Attention",
    })
    fireEvent.change(
      screen.getByLabelText("Choose WAYVM JSON backup for recovery"),
      { target: { files: [unreadableBackup] } },
    )

    const issue = await screen.findByRole("alert")
    expect(issue).toHaveTextContent(playerDataPortabilityCopy.importInvalid)
    expect(issue).toHaveFocus()
    expect(screen.getByText(/Nothing has been erased\./)).toBeVisible()
    expect(screen.getByRole("button", { name: "Import Backup" })).toBeEnabled()
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

    fireEvent.click(screen.getByRole("button", { name: "Export Current Data" }))
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

  it("returns to the unchanged Hub when a battle result cannot become durable", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000113",
    )
    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(await screen.findByRole("button", { name: "Battle" }))
    const winnerCard = (await screen.findByText("[1 / A]")).closest("button")
    if (!winnerCard) throw new Error("The recovery test winner is unavailable")

    durableStoreFailure.writeEnabled = true
    fireEvent.click(winnerCard)

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
    fireEvent.click(
      screen.getByRole("button", { name: "Return Without New Changes" }),
    )

    expect(
      await screen.findByRole("heading", { name: "Your Values", level: 1 }),
    ).toBeVisible()
    expect(
      screen.getByText(
        "Not ranked yet. Browse the included values, then battle when you are ready.",
      ),
    ).toBeVisible()
    expect(
      screen.queryByRole("heading", { name: "Top Five" }),
    ).not.toBeInTheDocument()
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

  it("preserves the active pair while Menu resumes or routes through Browse All Values", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000065",
    )

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(await screen.findByRole("button", { name: "Battle" }))
    const initialChoiceNames = (
      await screen.findAllByRole("button", {
        name: /^Choose /,
      })
    ).map((button) => button.getAttribute("aria-label"))

    fireEvent.keyDown(window, { key: "Escape" })
    expect(await screen.findByRole("dialog", { name: "Menu" })).toBeVisible()
    fireEvent.keyDown(window, { key: "1" })
    fireEvent.click(screen.getByRole("button", { name: "Resume Battle" }))

    expect(
      screen
        .getAllByRole("button", { name: /^Choose / })
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(initialChoiceNames)
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    fireEvent.click(
      await screen.findByRole("button", { name: "Browse All Values" }),
    )
    expect(
      await screen.findByRole("heading", { name: "All Values", level: 1 }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    fireEvent.click(await screen.findByRole("button", { name: "Battle" }))

    expect(
      (await screen.findAllByRole("button", { name: /^Choose / })).map(
        (button) => button.getAttribute("aria-label"),
      ),
    ).toEqual(initialChoiceNames)
  })

  it("routes the flat Menu between every shipped utility surface", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000066",
    )

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    await openProductMenuDestination("Achievements")
    expect(
      await screen.findByRole("heading", { name: "Achievements", level: 1 }),
    ).toBeVisible()

    await openProductMenuDestination("Import & Export")
    expect(
      await screen.findByRole("heading", {
        name: "Import & Export",
        level: 1,
      }),
    ).toBeVisible()

    await openProductMenuDestination("Browse All Values")
    expect(
      await screen.findByRole("heading", { name: "All Values", level: 1 }),
    ).toBeVisible()

    await openProductMenuDestination("Custom Values")
    expect(
      await screen.findByRole("form", { name: "Add Custom Value" }),
    ).toBeVisible()
  })

  it("opens the complete live achievement catalog and restores focus to its Hub action", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000054",
    )

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    await openProductMenuDestination("Achievements")

    expect(
      await screen.findByRole("heading", { name: "Achievements", level: 1 }),
    ).toHaveFocus()
    expect(screen.getByText("0 of 40 unlocked")).toBeVisible()
    expect(screen.getAllByRole("listitem")).toHaveLength(40)
    expect(screen.getByText("2,400 Battles")).toBeVisible()
    expect(screen.getByText("Reach Level 100")).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Back to Your Values" }))
    expect(await screen.findByRole("button", { name: "Menu" })).toHaveFocus()

    fireEvent.click(screen.getByRole("button", { name: "Battle" }))
    const winnerCard = (await screen.findByText("[1 / A]")).closest("button")
    if (!winnerCard) throw new Error("Achievement test winner is unavailable")
    fireEvent.click(winnerCard)
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole("button", { name: /Stop/ }))
    await openProductMenuDestination("Achievements")

    expect(await screen.findByText("1 of 40 unlocked")).toBeVisible()
    const firstBattle = screen.getAllByRole("listitem")[0]!
    expect(within(firstBattle).getAllByText("Unlocked")).toHaveLength(2)
    expect(within(firstBattle).getByRole("time")).toBeVisible()
    expect(
      within(firstBattle).queryByText("1 of 1 comparisons"),
    ).not.toBeInTheDocument()
  })

  it("announces the first durable milestone without blocking the next comparison and persists explicit dismissal", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000055",
    )

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(await screen.findByRole("button", { name: "Battle" }))
    const winnerCard = (await screen.findByText("[1 / A]")).closest("button")
    if (!winnerCard) throw new Error("Banner test winner is unavailable")
    fireEvent.click(winnerCard)

    expect(
      await screen.findByRole("heading", { name: "First Battle" }),
    ).toBeVisible()
    expect(screen.getByRole("status")).toHaveTextContent(
      "Achievement unlocked: First Battle.",
    )
    const battleSurface = screen.getByRole("main", { name: "Value battle" })
    const achievementBanner = screen.getByRole("complementary", {
      name: "Achievement unlocked",
    })
    const presentationRegion = achievementBanner.parentElement
    expect(battleSurface).not.toHaveClass("pb-[min(50dvh,17rem)]")
    expect(presentationRegion).toHaveClass("relative", "shrink-0", "flex-col")
    expect(presentationRegion).not.toHaveClass("absolute")
    expect(presentationRegion?.nextElementSibling).toHaveClass(
      "min-h-0",
      "flex-1",
      "xl:flex-row",
    )
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled(),
    )
    expect(battleSurface).toHaveAttribute("aria-busy", "false")

    fireEvent.click(screen.getByRole("button", { name: "Dismiss achievement" }))

    await waitFor(() =>
      expect(
        screen.queryByRole("complementary", { name: "Achievement unlocked" }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByRole("main", { name: "Value battle" })).not.toHaveClass(
      "pb-[min(50dvh,17rem)]",
    )
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
  })

  it("fails loudly when a pending milestone loses its canonical presentation", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000057",
    )
    vi.spyOn(console, "error").mockImplementation(() => undefined)

    render(
      <InvariantErrorBoundary>
        <GameClient />
      </InvariantErrorBoundary>,
    )
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(await screen.findByRole("button", { name: "Battle" }))
    const winnerCard = (await screen.findByText("[1 / A]")).closest("button")
    if (!winnerCard)
      throw new Error("Invariant banner test winner is unavailable")

    vi.spyOn(
      AchievementPresentation,
      "projectAchievementCatalog",
    ).mockReturnValue(Object.freeze([]))
    fireEvent.click(winnerCard)

    expect(
      await screen.findByText(
        "Pending achievement presentation is unavailable",
      ),
    ).toBeVisible()
  })

  it("preserves the unlocked milestone and complete recovery choices when banner acknowledgement cannot persist", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000056",
    )

    render(<GameClient />)
    fireEvent.click(await screen.findByRole("button", { name: "Start" }))
    fireEvent.click(await screen.findByRole("button", { name: "Battle" }))
    const winnerCard = (await screen.findByText("[1 / A]")).closest("button")
    if (!winnerCard)
      throw new Error("Banner recovery test winner is unavailable")
    fireEvent.click(winnerCard)
    await screen.findByRole("heading", { name: "First Battle" })

    durableStoreFailure.writeEnabled = true
    fireEvent.click(screen.getByRole("button", { name: "Dismiss achievement" }))

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
    expect(screen.getByRole("button", { name: "Try Again" })).toBeEnabled()

    durableStoreFailure.writeEnabled = false
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }))

    expect(
      await screen.findByRole("main", { name: "Value battle" }),
    ).toBeVisible()
    await waitFor(() =>
      expect(
        screen.queryByRole("complementary", { name: "Achievement unlocked" }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByRole("button", { name: "Undo" })).toBeEnabled()
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
    await openProductMenuDestination("Import & Export")
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
    expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus()
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
    await openProductMenuDestination("Import & Export")
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
    expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus()
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
    await openProductMenuDestination("Import & Export")
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
    await openProductMenuDestination("Import & Export")
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
    await openProductMenuDestination("Import & Export")
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
    await openProductMenuDestination("Import & Export")

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
    await openProductMenuDestination("Import & Export")

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
    await openProductMenuDestination("Import & Export")
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
    await openProductMenuDestination("Import & Export")
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
    await openProductMenuDestination("Import & Export")
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
    await openProductMenuDestination("Import & Export")
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

import {
  BATTLE_PROFILE_MANIFEST_KEY,
  BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
  BATTLE_PROFILE_SNAPSHOT_A_KEY,
} from "@game/machines/src/BattleProfileStore"
import { createInMemoryDurableStore } from "@game/machines/src/InMemoryDurableStore"
import { playerDataPortabilityCopy } from "@game/machines/src/PlayerDataPortabilityCopy"
import { playerDataRecoveryCopy } from "@game/machines/src/PlayerDataRecoveryCopy"
import { DELETE_ALL_DATA_ACKNOWLEDGMENT } from "@game/machines/src/PlayerDataReset"
import {
  playerDataResetBackupReadyNotice,
  playerDataResetCopy,
} from "@game/machines/src/PlayerDataResetCopy"
import { createWayvmExportV1TestVector } from "@game/machines/src/WayvmExportV1TestVector"
import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native"
import { AppState, type AppStateStatus } from "react-native"
import NativeGameClient from "@/components/NativeGameClient"
import useNativePlayerDataFiles from "@/components/useNativePlayerDataFiles"
import { expoDurableStore } from "@/lib/ExpoDurableStore"
import type { NativePlayerDataFileDestination } from "@/lib/NativePlayerDataFileEvents"

jest.mock("@/lib/ExpoDurableStore", () => ({
  expoDurableStore: {
    readAll: jest.fn(),
    compareAndSwapVerified: jest.fn(),
  },
}))

jest.mock("@/components/useNativePlayerDataFiles", () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock("expo-crypto", () => {
  let nextUuid = 0

  return {
    randomUUID: () => {
      nextUuid += 1
      return `00000000-0000-4000-8000-${nextUuid.toString().padStart(12, "0")}`
    },
  }
})

const readAll = jest.mocked(expoDurableStore.readAll)
const compareAndSwapVerified = jest.mocked(
  expoDurableStore.compareAndSwapVerified,
)
const usePlayerDataFiles = jest.mocked(useNativePlayerDataFiles)
const chooseBackup = jest.fn(async () => undefined)

beforeEach(() => {
  const store = createInMemoryDurableStore()
  readAll.mockImplementation(store.readAll)
  compareAndSwapVerified.mockImplementation(store.compareAndSwapVerified)
  usePlayerDataFiles.mockReturnValue({
    isReadingImportFile: false,
    chooseBackup,
  })
})

async function openMenuDestination(
  user: ReturnType<typeof userEvent.setup>,
  destinationLabel: string,
) {
  await user.press(await screen.findByRole("button", { name: "Menu" }))
  const menu = (await screen.findAllByLabelText("Menu")).find(
    ({ props }) => props.role === "dialog",
  )
  if (!menu) throw new Error("The native Product Menu dialog is unavailable")
  await user.press(within(menu).getByRole("button", { name: destinationLabel }))
}

function getPresentedChoiceNames() {
  return screen
    .getAllByRole("button", {
      name: /^Choose .+\. Level \d+\. Choice [12]\.$/,
    })
    .map(({ props }) => props.accessibilityLabel as unknown)
}

function getOpenDialog(label: string) {
  return screen
    .queryAllByLabelText(label)
    .find(({ props }) => props.role === "dialog")
}

describe("NativeGameClient Menu navigation", () => {
  it("routes every shipped destination and resumes the exact active pair", async () => {
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(await screen.findByRole("button", { name: "Start" }))
    expect(await screen.findByText("Your Values")).toBeOnTheScreen()

    await openMenuDestination(user, "Browse All Values")
    expect(await screen.findByText("All Values")).toBeOnTheScreen()

    await openMenuDestination(user, "Custom Values")
    expect(await screen.findByText("Custom Value Builder")).toBeOnTheScreen()
    await user.press(screen.getByRole("button", { name: "Cancel" }))

    await openMenuDestination(user, "Achievements")
    expect(await screen.findByText("Achievements")).toBeOnTheScreen()

    await openMenuDestination(user, "Import & Export")
    expect(await screen.findByText("Import & Export")).toBeOnTheScreen()

    await openMenuDestination(user, "Browse All Values")
    await user.press(await screen.findByRole("button", { name: "Close" }))
    expect(await screen.findByText("Your Values")).toBeOnTheScreen()

    await user.press(screen.getByRole("button", { name: "Battle" }))
    const presentedChoiceNames = getPresentedChoiceNames()
    expect(presentedChoiceNames).toHaveLength(2)

    await openMenuDestination(user, "Settings")
    expect(await screen.findByText("Settings")).toBeOnTheScreen()
    const controlHintsGroup = screen.getByLabelText("Control Hints")
    expect(
      within(controlHintsGroup).getByRole("radio", { name: "Auto" }),
    ).toBeChecked()
    await user.press(
      within(controlHintsGroup).getByRole("radio", { name: "Off" }),
    )
    await waitFor(() => {
      expect(
        within(screen.getByLabelText("Control Hints")).getByRole("radio", {
          name: "Off",
        }),
      ).toBeChecked()
      expect(screen.getByRole("button", { name: "Back" })).toBeEnabled()
    })

    await user.press(screen.getByRole("button", { name: "Menu" }))
    const settingsMenu = getOpenDialog("Menu")
    if (!settingsMenu)
      throw new Error("The native Settings Menu dialog is unavailable")
    await user.press(
      within(settingsMenu).getByRole("button", { name: "Close Menu" }),
    )
    expect(screen.getByText("Settings")).toBeOnTheScreen()

    await user.press(screen.getByRole("button", { name: "Reset Achievements" }))
    expect(await screen.findByText("Reset Achievements?")).toBeOnTheScreen()
    await user.press(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByText("Settings")).toBeOnTheScreen()

    await user.press(screen.getByRole("button", { name: "Back" }))
    await waitFor(() =>
      expect(getPresentedChoiceNames()).toEqual(presentedChoiceNames),
    )

    await openMenuDestination(user, "Settings")
    expect(
      within(await screen.findByLabelText("Control Hints")).getByRole("radio", {
        name: "Off",
      }),
    ).toBeChecked()
    await user.press(screen.getByRole("button", { name: "Back" }))
    expect(getPresentedChoiceNames()).toEqual(presentedChoiceNames)

    await openMenuDestination(user, "Controls")
    const controls = (await screen.findAllByLabelText("Controls")).find(
      ({ props }) => props.role === "dialog",
    )
    if (!controls) throw new Error("The native Controls dialog is unavailable")
    expect(
      within(controls).getByText("Tap the first value card"),
    ).toBeOnTheScreen()
    getPresentedChoiceNames().forEach((choiceName) =>
      expect(
        screen.getByRole("button", { name: String(choiceName) }),
      ).toBeDisabled(),
    )
    await user.press(
      within(controls).getAllByRole("button", { name: "Close" })[1],
    )
    expect(getPresentedChoiceNames()).toEqual(presentedChoiceNames)

    await openMenuDestination(user, "How It Works")
    expect(await screen.findByLabelText("How It Works")).toBeOnTheScreen()
    expect(
      screen.getByText("Start With 100 Values—or Add Your Own"),
    ).toBeOnTheScreen()
    await user.press(screen.getByRole("button", { name: "Close" }))

    expect(getPresentedChoiceNames()).toEqual(presentedChoiceNames)

    await user.press(screen.getByRole("button", { name: "Menu" }))
    await user.press(
      await screen.findByRole("button", { name: "Resume Battle" }),
    )

    expect(getPresentedChoiceNames()).toEqual(presentedChoiceNames)
  }, 10_000)

  it("routes every direct Hub destination back to the same durable profile", async () => {
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(await screen.findByRole("button", { name: "Start" }))

    await user.press(screen.getByRole("button", { name: "Achievements" }))
    expect(await screen.findByText("Achievements")).toBeOnTheScreen()
    await user.press(
      screen.getByRole("button", { name: "Back to Your Values" }),
    )

    await user.press(screen.getByRole("button", { name: "Import & Export" }))
    expect(await screen.findByText("Import & Export")).toBeOnTheScreen()
    await user.press(
      screen.getByRole("button", { name: "Back to Your Values" }),
    )

    await user.press(screen.getByRole("button", { name: "Browse All Values" }))
    expect(await screen.findByText("All Values")).toBeOnTheScreen()
    await user.press(screen.getByRole("button", { name: "Close" }))

    const valueDestination = screen.getAllByRole("button", {
      name: /^Open .+ in All Values$/,
    })[0]
    await user.press(valueDestination)
    expect(await screen.findByText("All Values")).toBeOnTheScreen()
    await user.press(screen.getByRole("button", { name: "Close" }))

    await user.press(screen.getByRole("button", { name: "Add Custom Value" }))
    expect(await screen.findByText("Custom Value Builder")).toBeOnTheScreen()
    await user.press(screen.getByRole("button", { name: "Cancel" }))
    await user.press(screen.getByRole("button", { name: "Close" }))

    expect(await screen.findByText("Your Values")).toBeOnTheScreen()
  }, 10_000)

  it("leaves active and return-target surfaces before routing onward", async () => {
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(await screen.findByRole("button", { name: "Start" }))
    await user.press(screen.getByRole("button", { name: "Battle" }))
    expect(getPresentedChoiceNames()).toHaveLength(2)

    await openMenuDestination(user, "Achievements")
    expect(await screen.findByText("Achievements")).toBeOnTheScreen()
    expect(screen.queryByLabelText("Value battle")).toBeNull()

    await openMenuDestination(user, "Settings")
    expect(await screen.findByText("Settings")).toBeOnTheScreen()

    await openMenuDestination(user, "Browse All Values")
    expect(await screen.findByText("All Values")).toBeOnTheScreen()
    expect(screen.queryByText("Achievements")).toBeNull()
    expect(screen.queryByText("Settings")).toBeNull()

    await user.press(screen.getByRole("button", { name: "Close" }))
    expect(await screen.findByText("Your Values")).toBeOnTheScreen()
  }, 10_000)
})

describe("NativeGameClient battle routing", () => {
  it("commits a winner then routes Undo Redo and Stop through the native shell", async () => {
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(await screen.findByRole("button", { name: "Start" }))
    await user.press(screen.getByRole("button", { name: "Battle" }))

    await user.press(
      screen.getAllByRole("button", {
        name: /^Choose .+\. Level \d+\. Choice [12]\.$/,
      })[0],
    )
    await user.press(
      await screen.findByRole("button", { name: "Dismiss achievement" }),
    )

    const undo = await screen.findByRole("button", { name: "Undo" })
    await waitFor(() => expect(undo).toBeEnabled())
    await user.press(undo)

    const redo = screen.getByRole("button", { name: "Redo" })
    await waitFor(() => expect(redo).toBeEnabled())
    await user.press(redo)
    await waitFor(() => expect(undo).toBeEnabled())

    await user.press(screen.getByRole("button", { name: "Stop" }))

    expect(await screen.findByText("Your Values")).toBeOnTheScreen()
  }, 10_000)
})

describe("NativeGameClient persistence recovery and lifecycle", () => {
  it("offers only a retry after initial durable storage cannot be read", async () => {
    readAll.mockRejectedValueOnce(new Error("Native storage unavailable"))
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    expect(
      await screen.findByText(playerDataRecoveryCopy.storageUnavailable.title),
    ).toBeOnTheScreen()
    expect(screen.getByText("Native storage unavailable")).toHaveProp(
      "accessibilityRole",
      "alert",
    )
    expect(screen.getAllByRole("button")).toHaveLength(1)

    await user.press(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.tryAgain,
      }),
    )

    expect(await screen.findByRole("button", { name: "Start" })).toBeEnabled()
  })

  it("preserves corrupt local bytes behind the unreadable-data recovery surface", async () => {
    readAll.mockResolvedValue(
      new Map([
        [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
        [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      ]),
    )
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    expect(
      await screen.findByText(playerDataRecoveryCopy.unreadableData.title),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(playerDataRecoveryCopy.unreadableData.noKnownGoodSave),
    ).toHaveProp("accessibilityRole", "alert")
    expect(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.importBackup,
      }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.exportUnreadableData,
      }),
    ).toBeEnabled()
    expect(
      screen.queryByRole("button", {
        name: playerDataRecoveryCopy.actions.restoreLastKnownGoodSave,
      }),
    ).not.toBeOnTheScreen()

    await user.press(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.tryAgain,
      }),
    )
    await waitFor(() => expect(readAll).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByText(playerDataRecoveryCopy.unreadableData.title),
    ).toBeOnTheScreen()
  })

  it("blocks corrupt-data recovery actions while a selected backup is read", async () => {
    readAll.mockResolvedValue(
      new Map([
        [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
        [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      ]),
    )
    usePlayerDataFiles.mockReturnValue({
      isReadingImportFile: true,
      chooseBackup,
    })
    await render(<NativeGameClient />)

    expect(await screen.findByText("Checking backup…")).toHaveProp(
      "accessibilityLiveRegion",
      "polite",
    )
    expect(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.importBackup,
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.deleteAllData,
      }),
    ).toBeDisabled()
  })

  it("allows a safe return when first-run initialization cannot persist", async () => {
    compareAndSwapVerified.mockRejectedValueOnce(
      new Error("Native storage write failed"),
    )
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(await screen.findByRole("button", { name: "Start" }))
    expect(
      await screen.findByText(playerDataRecoveryCopy.storageUnavailable.title),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.exportCurrentData,
      }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.returnWithoutNewChanges,
      }),
    ).toBeEnabled()

    await user.press(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.exportCurrentData,
      }),
    )
    expect(
      await screen.findByText(
        playerDataRecoveryCopy.storageUnavailable.currentBackupReady,
      ),
    ).toHaveProp("accessibilityLiveRegion", "polite")

    await user.press(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.returnWithoutNewChanges,
      }),
    )

    expect(await screen.findByRole("button", { name: "Start" })).toBeEnabled()
  })

  it("closes overlays and checkpoints only when the app enters background", async () => {
    let notifyAppState: (appState: AppStateStatus) => void = () => undefined
    const remove = jest.fn()
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_eventType, listener) => {
        notifyAppState = listener
        return { remove }
      })
    const user = userEvent.setup()
    const { unmount } = await render(<NativeGameClient />)

    await user.press(await screen.findByRole("button", { name: "Start" }))
    await user.press(await screen.findByRole("button", { name: "Menu" }))
    expect(getOpenDialog("Menu")).toBeDefined()

    await act(async () => {
      notifyAppState("active")
      await Promise.resolve()
    })
    expect(getOpenDialog("Menu")).toBeDefined()

    await act(async () => {
      notifyAppState("background")
      await Promise.resolve()
    })
    await waitFor(() => expect(getOpenDialog("Menu")).toBeUndefined())
    expect(await screen.findByText("Your Values")).toBeOnTheScreen()

    await unmount()
    expect(remove).toHaveBeenCalledTimes(1)
  })
})

describe("NativeGameClient file operations and destructive actions", () => {
  it("cancels then acknowledges complete deletion from corrupt-data recovery", async () => {
    const corruptStore = createInMemoryDurableStore([
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
    ])
    readAll.mockImplementation(corruptStore.readAll)
    compareAndSwapVerified.mockImplementation(
      corruptStore.compareAndSwapVerified,
    )
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(
      await screen.findByRole("button", {
        name: playerDataRecoveryCopy.actions.deleteAllData,
      }),
    )
    expect(
      await screen.findByText(
        playerDataResetCopy["delete-all-data"].confirmationTitle,
      ),
    ).toBeOnTheScreen()
    await user.press(screen.getByRole("button", { name: "Cancel" }))
    expect(
      await screen.findByText(playerDataRecoveryCopy.unreadableData.title),
    ).toBeOnTheScreen()

    await user.press(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.deleteAllData,
      }),
    )
    await fireEvent(
      screen.getByRole("switch", {
        name: DELETE_ALL_DATA_ACKNOWLEDGMENT,
      }),
      "valueChange",
      true,
    )
    await user.press(
      screen.getByRole("button", {
        name: playerDataResetCopy["delete-all-data"].actionLabel,
      }),
    )

    expect(await screen.findByRole("button", { name: "Start" })).toBeEnabled()
  })

  it("updates and deletes a Custom Value through the durable native shell", async () => {
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(await screen.findByRole("button", { name: "Start" }))
    await user.press(
      await screen.findByRole("button", { name: "Add Custom Value" }),
    )
    await user.press(
      screen.getByRole("button", { name: /^\+ Start with Ingenuity/ }),
    )
    await user.press(screen.getByRole("button", { name: "Save Value" }))

    await user.type(screen.getByLabelText("Search All Values"), "Ingenuity")
    const ingenuity = await screen.findByLabelText("Ingenuity details")
    await user.press(within(ingenuity).getByRole("button", { name: "Edit" }))
    const definition = screen.getByLabelText("What This Value Means to Me")
    await user.clear(definition)
    await user.type(definition, "Resourceful and original problem solving.")
    await user.press(screen.getByRole("button", { name: "Review Update" }))
    await user.press(screen.getByRole("button", { name: "Update Value" }))

    await user.type(screen.getByLabelText("Search All Values"), "Ingenuity")
    expect(
      await screen.findByText("“Resourceful and original problem solving.”"),
    ).toBeOnTheScreen()
    await user.press(
      within(screen.getByLabelText("Ingenuity details")).getByRole("button", {
        name: "Delete",
      }),
    )
    await user.press(screen.getByRole("button", { name: "Remove Value" }))

    await waitFor(() =>
      expect(
        screen.queryByLabelText("Ingenuity details"),
      ).not.toBeOnTheScreen(),
    )
  }, 10_000)

  it("routes ordinary backup selection and export through the native file boundary", async () => {
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(await screen.findByRole("button", { name: "Start" }))
    await openMenuDestination(user, "Import & Export")
    await user.press(
      screen.getByRole("button", {
        name: playerDataPortabilityCopy.chooseBackupAction,
      }),
    )
    expect(chooseBackup).toHaveBeenCalledWith("data-management")

    await user.press(
      screen.getByRole("button", {
        name: playerDataPortabilityCopy.exportAction,
      }),
    )
    expect(
      await screen.findByText(playerDataPortabilityCopy.exportSuccess),
    ).toHaveProp("accessibilityLiveRegion", "polite")

    await user.press(
      screen.getByRole("button", {
        name: playerDataResetCopy["reset-levels-and-experience"].actionLabel,
      }),
    )
    expect(
      await screen.findByText(
        playerDataResetCopy["reset-levels-and-experience"].confirmationTitle,
      ),
    ).toBeOnTheScreen()
    await user.press(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByText("Import & Export")).toBeOnTheScreen()
  })

  it("cancels then confirms a reviewed backup from Import and Export", async () => {
    const { serialized } = await createWayvmExportV1TestVector()
    usePlayerDataFiles.mockImplementation(({ send }) => ({
      isReadingImportFile: false,
      chooseBackup: async (destination: NativePlayerDataFileDestination) => {
        if (destination !== "data-management")
          throw new Error("The backup picker received the wrong destination")

        send({
          type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
          serialized,
        })
      },
    }))
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(await screen.findByRole("button", { name: "Start" }))
    await openMenuDestination(user, "Import & Export")
    await user.press(
      screen.getByRole("button", {
        name: playerDataPortabilityCopy.chooseBackupAction,
      }),
    )
    expect(
      await screen.findByText(playerDataPortabilityCopy.importPreviewTitle),
    ).toBeOnTheScreen()

    await user.press(
      screen.getByRole("button", {
        name: playerDataPortabilityCopy.importCancelAction,
      }),
    )
    expect(
      await screen.findByText(playerDataPortabilityCopy.importCancelled),
    ).toHaveProp("accessibilityLiveRegion", "polite")

    await user.press(
      screen.getByRole("button", {
        name: playerDataPortabilityCopy.chooseBackupAction,
      }),
    )
    await user.press(
      await screen.findByRole("button", {
        name: playerDataPortabilityCopy.importReplaceAction,
      }),
    )

    expect(await screen.findByText("Your Values")).toBeOnTheScreen()
  }, 10_000)

  it("blocks Import and Export navigation while a selected backup is read", async () => {
    usePlayerDataFiles.mockReturnValue({
      isReadingImportFile: true,
      chooseBackup,
    })
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(await screen.findByRole("button", { name: "Start" }))
    await openMenuDestination(user, "Import & Export")

    expect(await screen.findByText("Checking backup…")).toHaveProp(
      "accessibilityLiveRegion",
      "polite",
    )
    expect(screen.getByRole("button", { name: "Menu" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Back to Your Values" }),
    ).toBeDisabled()
  })

  it("routes unreadable-save import and diagnostic export through recovery", async () => {
    readAll.mockResolvedValue(
      new Map([
        [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
        [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      ]),
    )
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(
      await screen.findByRole("button", {
        name: playerDataRecoveryCopy.actions.importBackup,
      }),
    )
    expect(chooseBackup).toHaveBeenCalledWith("recovery")

    await user.press(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.exportUnreadableData,
      }),
    )
    expect(
      await screen.findByText(
        playerDataRecoveryCopy.unreadableData.diagnosticReady,
      ),
    ).toHaveProp("accessibilityLiveRegion", "polite")
  })

  it("cancels then confirms a selected backup from corrupt-data recovery", async () => {
    const { serialized } = await createWayvmExportV1TestVector()
    const corruptStore = createInMemoryDurableStore([
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
    ])
    readAll.mockImplementation(corruptStore.readAll)
    compareAndSwapVerified.mockImplementation(
      corruptStore.compareAndSwapVerified,
    )
    usePlayerDataFiles.mockImplementation(({ send }) => ({
      isReadingImportFile: false,
      chooseBackup: async (destination: NativePlayerDataFileDestination) => {
        if (destination !== "recovery")
          throw new Error("The recovery picker received the wrong destination")

        send({ type: "RECOVERY.IMPORT_PREPARE_REQUESTED", serialized })
      },
    }))
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(
      await screen.findByRole("button", {
        name: playerDataRecoveryCopy.actions.importBackup,
      }),
    )
    expect(
      await screen.findByText(
        playerDataRecoveryCopy.unreadableData.selectedBackupReviewTitle,
      ),
    ).toBeOnTheScreen()

    await user.press(
      screen.getByRole("button", {
        name: playerDataPortabilityCopy.importCancelAction,
      }),
    )
    expect(
      await screen.findByText(playerDataRecoveryCopy.unreadableData.title),
    ).toBeOnTheScreen()

    await user.press(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.importBackup,
      }),
    )
    await user.press(
      await screen.findByRole("button", {
        name: playerDataRecoveryCopy.unreadableData.selectedBackupReviewAction,
      }),
    )

    expect(await screen.findByText("Your Values")).toBeOnTheScreen()
  }, 10_000)

  it("reviews a retained last-known-good backup from corrupt-data recovery", async () => {
    const { serialized } = await createWayvmExportV1TestVector()
    const corruptStore = createInMemoryDurableStore([
      [BATTLE_PROFILE_MANIFEST_KEY, "corrupt-manifest"],
      [BATTLE_PROFILE_SNAPSHOT_A_KEY, "corrupt-checkpoint"],
      [BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY, serialized],
    ])
    readAll.mockImplementation(corruptStore.readAll)
    compareAndSwapVerified.mockImplementation(
      corruptStore.compareAndSwapVerified,
    )
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(
      await screen.findByRole("button", {
        name: playerDataRecoveryCopy.actions.restoreLastKnownGoodSave,
      }),
    )

    expect(
      await screen.findByText(
        playerDataRecoveryCopy.unreadableData.restoreReviewTitle,
      ),
    ).toBeOnTheScreen()
  })

  it("routes every scoped reset through review and preserves remaining data", async () => {
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(await screen.findByRole("button", { name: "Start" }))
    await user.press(
      await screen.findByRole("button", { name: "Add Custom Value" }),
    )
    await user.press(
      screen.getByRole("button", { name: /^\+ Start with Ingenuity/ }),
    )
    await user.press(screen.getByRole("button", { name: "Save Value" }))
    await user.press(await screen.findByRole("button", { name: "Close" }))
    await openMenuDestination(user, "Import & Export")

    await user.press(
      screen.getByRole("button", {
        name: playerDataResetCopy["delete-all-custom-values"].actionLabel,
      }),
    )
    expect(
      await screen.findByText(
        playerDataResetCopy["delete-all-custom-values"].confirmationTitle,
      ),
    ).toBeOnTheScreen()
    await user.press(
      screen.getByRole("button", {
        name: playerDataResetCopy["delete-all-custom-values"].actionLabel,
      }),
    )
    expect(
      await screen.findByText(
        playerDataResetCopy["delete-all-custom-values"].successAnnouncement,
      ),
    ).toHaveProp("accessibilityLiveRegion", "polite")

    await openMenuDestination(user, "Settings")

    await user.press(
      screen.getByRole("button", {
        name: playerDataResetCopy["reset-levels-and-experience"].actionLabel,
      }),
    )
    expect(
      await screen.findByText(
        playerDataResetCopy["reset-levels-and-experience"].confirmationTitle,
      ),
    ).toBeOnTheScreen()
    await user.press(screen.getByRole("button", { name: "Export Data" }))
    expect(
      await screen.findByText(playerDataResetBackupReadyNotice),
    ).toHaveProp("accessibilityLiveRegion", "polite")
    await user.press(screen.getByRole("button", { name: "Cancel" }))

    await user.press(
      screen.getByRole("button", {
        name: playerDataResetCopy["reset-achievements"].actionLabel,
      }),
    )
    expect(
      await screen.findByText(
        playerDataResetCopy["reset-achievements"].confirmationTitle,
      ),
    ).toBeOnTheScreen()
    await user.press(
      screen.getByRole("button", {
        name: playerDataResetCopy["reset-achievements"].actionLabel,
      }),
    )
    expect(
      await screen.findByText(
        playerDataResetCopy["reset-achievements"].successAnnouncement,
      ),
    ).toHaveProp("accessibilityLiveRegion", "polite")
  }, 10_000)

  it("requires explicit acknowledgement before deleting every local record", async () => {
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(await screen.findByRole("button", { name: "Start" }))
    await openMenuDestination(user, "Settings")
    await user.press(
      screen.getByRole("button", {
        name: playerDataResetCopy["delete-all-data"].actionLabel,
      }),
    )

    const confirmDeletion = await screen.findByRole("button", {
      name: playerDataResetCopy["delete-all-data"].actionLabel,
    })
    expect(confirmDeletion).toBeDisabled()
    await fireEvent(
      screen.getByRole("switch", {
        name: DELETE_ALL_DATA_ACKNOWLEDGMENT,
      }),
      "valueChange",
      true,
    )
    const acknowledgedDeletion = screen.getByRole("button", {
      name: playerDataResetCopy["delete-all-data"].actionLabel,
    })
    expect(acknowledgedDeletion).toBeEnabled()
    await user.press(acknowledgedDeletion)

    expect(await screen.findByRole("button", { name: "Start" })).toBeEnabled()
  })

  it("confirms a reviewed level reset and reports the durable result", async () => {
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(await screen.findByRole("button", { name: "Start" }))
    await openMenuDestination(user, "Import & Export")
    const actionLabel =
      playerDataResetCopy["reset-levels-and-experience"].actionLabel

    await user.press(screen.getByRole("button", { name: actionLabel }))
    expect(
      await screen.findByText(
        playerDataResetCopy["reset-levels-and-experience"].confirmationTitle,
      ),
    ).toBeOnTheScreen()

    await user.press(screen.getByRole("button", { name: actionLabel }))

    expect(
      await screen.findByText(
        playerDataResetCopy["reset-levels-and-experience"].successAnnouncement,
      ),
    ).toHaveProp("accessibilityLiveRegion", "polite")
  })
})

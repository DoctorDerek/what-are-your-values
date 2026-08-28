import {
  BATTLE_PROFILE_MANIFEST_KEY,
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
})

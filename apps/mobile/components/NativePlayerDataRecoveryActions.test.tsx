import { playerDataRecoveryCopy } from "@game/machines/src/PlayerDataRecoveryCopy"
import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import NativePlayerDataRecoveryActions from "@/components/NativePlayerDataRecoveryActions"

function createUnreadableDataCallbacks() {
  return {
    onDeleteAllData: jest.fn(),
    onExportUnreadableData: jest.fn(),
    onImportBackup: jest.fn(),
    onRestoreLastKnownGoodSave: jest.fn(),
    onTryAgain: jest.fn(),
  }
}

function createStorageUnavailableCallbacks() {
  return {
    onExportCurrentData: jest.fn(),
    onReturnWithoutNewChanges: jest.fn(),
    onTryAgain: jest.fn(),
  }
}

describe("NativePlayerDataRecoveryActions", () => {
  it("offers every safe unreadable-data action in the approved order", async () => {
    const callbacks = createUnreadableDataCallbacks()
    const user = userEvent.setup()
    await render(
      <NativePlayerDataRecoveryActions
        {...callbacks}
        mode="unreadable-data"
        hasLastKnownGoodSave
        isBusy={false}
      />,
    )

    const expectedActions = [
      playerDataRecoveryCopy.actions.restoreLastKnownGoodSave,
      playerDataRecoveryCopy.actions.importBackup,
      playerDataRecoveryCopy.actions.exportUnreadableData,
      playerDataRecoveryCopy.actions.tryAgain,
      playerDataRecoveryCopy.actions.deleteAllData,
    ]
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(expectedActions.length)
    expectedActions.forEach((action, index) =>
      expect(buttons[index]).toBe(screen.getByRole("button", { name: action })),
    )

    for (const action of expectedActions)
      await user.press(screen.getByRole("button", { name: action }))

    expect(callbacks.onRestoreLastKnownGoodSave).toHaveBeenCalledTimes(1)
    expect(callbacks.onImportBackup).toHaveBeenCalledTimes(1)
    expect(callbacks.onExportUnreadableData).toHaveBeenCalledTimes(1)
    expect(callbacks.onTryAgain).toHaveBeenCalledTimes(1)
    expect(callbacks.onDeleteAllData).toHaveBeenCalledTimes(1)
  })

  it("hides unavailable restoration and disables every remaining busy action", async () => {
    const callbacks = createUnreadableDataCallbacks()
    await render(
      <NativePlayerDataRecoveryActions
        {...callbacks}
        mode="unreadable-data"
        hasLastKnownGoodSave={false}
        isBusy
      />,
    )

    expect(
      screen.queryByRole("button", {
        name: playerDataRecoveryCopy.actions.restoreLastKnownGoodSave,
      }),
    ).not.toBeOnTheScreen()
    expect(screen.getAllByRole("button")).toHaveLength(4)
    for (const action of screen.getAllByRole("button"))
      expect(action).toBeDisabled()
  })

  it("offers only storage actions supported by the current in-memory data", async () => {
    const callbacks = createStorageUnavailableCallbacks()
    const user = userEvent.setup()
    const { rerender } = await render(
      <NativePlayerDataRecoveryActions
        {...callbacks}
        mode="storage-unavailable"
        canExportCurrentData
        canReturnWithoutNewChanges
        isBusy={false}
      />,
    )

    const expectedActions = [
      playerDataRecoveryCopy.actions.exportCurrentData,
      playerDataRecoveryCopy.actions.tryAgain,
      playerDataRecoveryCopy.actions.returnWithoutNewChanges,
    ]
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(expectedActions.length)
    expectedActions.forEach((action, index) =>
      expect(buttons[index]).toBe(screen.getByRole("button", { name: action })),
    )

    for (const action of expectedActions)
      await user.press(screen.getByRole("button", { name: action }))

    expect(callbacks.onExportCurrentData).toHaveBeenCalledTimes(1)
    expect(callbacks.onTryAgain).toHaveBeenCalledTimes(1)
    expect(callbacks.onReturnWithoutNewChanges).toHaveBeenCalledTimes(1)

    await rerender(
      <NativePlayerDataRecoveryActions
        {...callbacks}
        mode="storage-unavailable"
        canExportCurrentData={false}
        canReturnWithoutNewChanges={false}
        isBusy
      />,
    )

    expect(screen.getAllByRole("button")).toHaveLength(1)
    expect(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.tryAgain,
      }),
    ).toBeDisabled()
  })
})

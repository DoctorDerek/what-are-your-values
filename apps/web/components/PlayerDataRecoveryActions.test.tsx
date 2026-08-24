import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PlayerDataRecoveryActions, {
  playerDataRecoveryActionIds,
} from "./PlayerDataRecoveryActions"

describe("Player Data Recovery Actions", () => {
  it("offers every safe unreadable-save path when a known-good save exists", () => {
    const handlers = {
      onDeleteAllData: vi.fn(),
      onExportUnreadableData: vi.fn(),
      onImportBackup: vi.fn(),
      onRestoreLastKnownGoodSave: vi.fn(),
      onTryAgain: vi.fn(),
    }
    render(
      <PlayerDataRecoveryActions
        mode="unreadable-data"
        hasLastKnownGoodSave
        isBusy={false}
        {...handlers}
      />,
    )

    for (const actionName of [
      "Restore Last Known-Good Save",
      "Import Backup",
      "Export Unreadable Data",
      "Try Again",
      "Delete All Data",
    ]) {
      const action = screen.getByRole("button", { name: actionName })
      expect(action).toBeEnabled()
      fireEvent.click(action)
    }
    expect(
      screen.getByRole("button", { name: "Import Backup" }),
    ).toHaveAttribute("id", playerDataRecoveryActionIds.importBackup)
    expect(
      screen.getByRole("button", { name: "Delete All Data" }),
    ).toHaveAttribute("id", playerDataRecoveryActionIds.deleteAllData)
    expect(
      screen.getByRole("button", { name: "Restore Last Known-Good Save" }),
    ).toHaveAttribute(
      "id",
      playerDataRecoveryActionIds.restoreLastKnownGoodSave,
    )
    const recoveryActions = screen.getByRole("button", {
      name: "Import Backup",
    }).parentElement
    expect(recoveryActions).toHaveClass("grid-cols-1", "xl:grid-cols-2")
    expect(recoveryActions).not.toHaveClass("sm:grid-cols-2")
    expect(screen.getByRole("button", { name: "Delete All Data" })).toHaveClass(
      "xl:col-span-2",
    )
    expect(
      screen.getByRole("button", { name: "Delete All Data" }),
    ).not.toHaveClass("sm:col-span-2")
    for (const handler of Object.values(handlers)) {
      expect(handler).toHaveBeenCalledOnce()
    }
  })

  it("does not offer restoration when no known-good save exists", () => {
    render(
      <PlayerDataRecoveryActions
        mode="unreadable-data"
        hasLastKnownGoodSave={false}
        isBusy={false}
        onDeleteAllData={vi.fn()}
        onExportUnreadableData={vi.fn()}
        onImportBackup={vi.fn()}
        onRestoreLastKnownGoodSave={vi.fn()}
        onTryAgain={vi.fn()}
      />,
    )

    expect(
      screen.queryByRole("button", {
        name: "Restore Last Known-Good Save",
      }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Import Backup" })).toBeEnabled()
  })

  it("shows only storage-failure actions supported by real in-memory state", () => {
    const onTryAgain = vi.fn()
    const { rerender } = render(
      <PlayerDataRecoveryActions
        mode="storage-unavailable"
        canExportCurrentData={false}
        canReturnWithoutNewChanges={false}
        isBusy={false}
        onExportCurrentData={vi.fn()}
        onReturnWithoutNewChanges={vi.fn()}
        onTryAgain={onTryAgain}
      />,
    )

    expect(
      screen.queryByRole("button", { name: "Export Current Data" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Return Without New Changes" }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }))
    expect(onTryAgain).toHaveBeenCalledOnce()

    rerender(
      <PlayerDataRecoveryActions
        mode="storage-unavailable"
        canExportCurrentData
        canReturnWithoutNewChanges
        isBusy
        onExportCurrentData={vi.fn()}
        onReturnWithoutNewChanges={vi.fn()}
        onTryAgain={onTryAgain}
      />,
    )
    expect(
      screen.getByRole("button", { name: "Export Current Data" }),
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: "Try Again" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Return Without New Changes" }),
    ).toBeDisabled()
    const recoveryActions = screen.getByRole("button", {
      name: "Try Again",
    }).parentElement
    expect(recoveryActions).toHaveClass("grid-cols-1", "xl:grid-cols-2")
    expect(recoveryActions).not.toHaveClass("sm:grid-cols-2")
    expect(
      screen.getByRole("button", { name: "Return Without New Changes" }),
    ).toHaveClass("xl:col-span-2")
  })
})

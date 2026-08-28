import { playerDataRecoveryCopy } from "@game/machines/src/PlayerDataRecoveryCopy"
import type { PlayerDataResetReview } from "@game/machines/src/PlayerDataReset"
import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import NativePersistenceFailure from "@/components/NativePersistenceFailure"

const preview = Object.freeze({
  exportedAt: "2026-08-06T12:34:56.000Z",
  sourceAppVersion: "0.1.0",
  sourceBuild: "native-recovery-test",
  saveSchemaVersion: 1,
  canonicalCatalogVersion: "pvcs-2011-100-v1",
  totalComparisons: 42,
  currentCycle: 3,
  customValueCount: 1,
  customValueNames: Object.freeze(["Ingenuity"]),
  activeValueCount: 101,
  activePairCycleSize: 5_050,
  deckRevision: 2,
  progressGeneration: 1,
  unlockedAchievementCount: 4,
  achievementProgressGeneration: 1,
  locale: "en",
  replacesCurrentLocalData: true,
}) satisfies WayvmImportPreview

const resetReview = Object.freeze({
  resetKind: "reset-achievements",
  confirmationId: "native-recovery-reset-review",
}) satisfies PlayerDataResetReview

function createUnreadableDataCallbacks() {
  return {
    onCancelImport: jest.fn(),
    onCancelReset: jest.fn(),
    onConfirmImport: jest.fn(),
    onConfirmReset: jest.fn(),
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

describe("NativePersistenceFailure", () => {
  it("keeps unreadable data recoverable when no known-good save exists", async () => {
    const callbacks = createUnreadableDataCallbacks()
    const user = userEvent.setup()
    await render(
      <NativePersistenceFailure
        {...callbacks}
        mode="unreadable-data"
        activity={null}
        hasLastKnownGoodSave={false}
        issue="The current save failed validation."
        notice="The unreadable bytes remain available."
        pendingImportSource={null}
        preview={null}
        resetReview={null}
      />,
    )

    expect(
      screen.getByRole("heading", {
        name: playerDataRecoveryCopy.unreadableData.title,
      }),
    ).toBeOnTheScreen()
    for (const paragraph of playerDataRecoveryCopy.unreadableData.body)
      expect(screen.getByText(paragraph)).toBeOnTheScreen()
    expect(
      screen.getByText(playerDataRecoveryCopy.unreadableData.noKnownGoodSave),
    ).toHaveProp("accessibilityRole", "alert")
    expect(screen.getByText("The current save failed validation.")).toHaveProp(
      "accessibilityRole",
      "alert",
    )
    expect(
      screen.queryByRole("button", {
        name: playerDataRecoveryCopy.actions.restoreLastKnownGoodSave,
      }),
    ).not.toBeOnTheScreen()

    await user.press(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.importBackup,
      }),
    )
    await user.press(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.exportUnreadableData,
      }),
    )
    expect(callbacks.onImportBackup).toHaveBeenCalledTimes(1)
    expect(callbacks.onExportUnreadableData).toHaveBeenCalledTimes(1)
  })

  it("offers known-good restoration while disabling all actions during work", async () => {
    const callbacks = createUnreadableDataCallbacks()
    await render(
      <NativePersistenceFailure
        {...callbacks}
        mode="unreadable-data"
        activity="Restoring backup…"
        hasLastKnownGoodSave
        issue={null}
        notice={null}
        pendingImportSource={null}
        preview={null}
        resetReview={null}
      />,
    )

    expect(screen.getByText("Restoring backup…")).toHaveProp(
      "accessibilityLiveRegion",
      "polite",
    )
    for (const action of screen.getAllByRole("button"))
      expect(action).toBeDisabled()
  })

  it.each([
    {
      pendingImportSource: "selected-backup" as const,
      title: playerDataRecoveryCopy.unreadableData.selectedBackupReviewTitle,
      warning: playerDataRecoveryCopy.unreadableData.selectedBackupConfirmation,
      confirmLabel:
        playerDataRecoveryCopy.unreadableData.selectedBackupReviewAction,
    },
    {
      pendingImportSource: "last-known-good" as const,
      title: playerDataRecoveryCopy.unreadableData.restoreReviewTitle,
      warning: playerDataRecoveryCopy.unreadableData.restoreConfirmation,
      confirmLabel: playerDataRecoveryCopy.unreadableData.restoreReviewAction,
    },
  ])(
    "routes $pendingImportSource import review without exposing recovery actions",
    async ({ confirmLabel, pendingImportSource, title, warning }) => {
      const callbacks = createUnreadableDataCallbacks()
      const user = userEvent.setup()
      await render(
        <NativePersistenceFailure
          {...callbacks}
          mode="unreadable-data"
          activity={null}
          hasLastKnownGoodSave
          issue={null}
          notice={null}
          pendingImportSource={pendingImportSource}
          preview={preview}
          resetReview={null}
        />,
      )

      expect(screen.getByRole("heading", { name: title })).toBeOnTheScreen()
      expect(screen.getByText(warning)).toHaveProp("accessibilityRole", "alert")
      expect(
        screen.queryByRole("button", {
          name: playerDataRecoveryCopy.actions.tryAgain,
        }),
      ).not.toBeOnTheScreen()

      await user.press(screen.getByRole("button", { name: confirmLabel }))
      await user.press(screen.getByRole("button", { name: "Cancel" }))
      expect(callbacks.onConfirmImport).toHaveBeenCalledTimes(1)
      expect(callbacks.onCancelImport).toHaveBeenCalledTimes(1)
    },
  )

  it("keeps destructive review inside recovery while preserving export", async () => {
    const callbacks = createUnreadableDataCallbacks()
    const user = userEvent.setup()
    await render(
      <NativePersistenceFailure
        {...callbacks}
        mode="unreadable-data"
        activity={null}
        hasLastKnownGoodSave
        issue={null}
        notice={null}
        pendingImportSource={null}
        preview={null}
        resetReview={resetReview}
      />,
    )

    expect(
      screen.queryByRole("button", {
        name: playerDataRecoveryCopy.actions.tryAgain,
      }),
    ).not.toBeOnTheScreen()
    await user.press(screen.getByRole("button", { name: "Export Data" }))
    await user.press(screen.getByRole("button", { name: "Cancel" }))
    await user.press(screen.getByRole("button", { name: "Reset Achievements" }))

    expect(callbacks.onExportUnreadableData).toHaveBeenCalledTimes(1)
    expect(callbacks.onCancelReset).toHaveBeenCalledTimes(1)
    expect(callbacks.onConfirmReset).toHaveBeenCalledWith(resetReview)
  })

  it("routes only supported storage-unavailable recovery actions", async () => {
    const callbacks = createStorageUnavailableCallbacks()
    const user = userEvent.setup()
    await render(
      <NativePersistenceFailure
        {...callbacks}
        mode="storage-unavailable"
        activity={null}
        canExportCurrentData
        canReturnWithoutNewChanges
        issue="Storage writes are unavailable."
        notice={null}
      />,
    )

    expect(
      screen.getByRole("heading", {
        name: playerDataRecoveryCopy.storageUnavailable.title,
      }),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(playerDataRecoveryCopy.storageUnavailable.body),
    ).toBeOnTheScreen()

    await user.press(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.exportCurrentData,
      }),
    )
    await user.press(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.tryAgain,
      }),
    )
    await user.press(
      screen.getByRole("button", {
        name: playerDataRecoveryCopy.actions.returnWithoutNewChanges,
      }),
    )

    expect(callbacks.onExportCurrentData).toHaveBeenCalledTimes(1)
    expect(callbacks.onTryAgain).toHaveBeenCalledTimes(1)
    expect(callbacks.onReturnWithoutNewChanges).toHaveBeenCalledTimes(1)
  })
})

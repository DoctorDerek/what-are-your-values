import type { PlayerDataResetReview } from "@game/machines/src/PlayerDataReset"
import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PlayerDataRecovery from "./PlayerDataRecovery"

const preview = Object.freeze({
  exportedAt: "2026-08-07T12:34:56.000Z",
  sourceAppVersion: "0.1.0",
  sourceBuild: "recovery-build",
  saveSchemaVersion: 1,
  canonicalCatalogVersion: "pvcs-2011-100-v1",
  totalComparisons: 42,
  currentCycle: 3,
  customValueCount: 2,
  customValueNames: Object.freeze(["Ingenuity", "Meaning"]),
  activeValueCount: 102,
  activePairCycleSize: 5_151,
  deckRevision: 2,
  progressGeneration: 1,
  unlockedAchievementCount: 4,
  achievementProgressGeneration: 1,
  locale: "en",
  replacesCurrentLocalData: true,
}) satisfies WayvmImportPreview

const unreadableDataHandlers = Object.freeze({
  onCancelImport: vi.fn(),
  onCancelReset: vi.fn(),
  onConfirmImport: vi.fn(),
  onConfirmReset: vi.fn(),
  onDeleteAllData: vi.fn(),
  onExportUnreadableData: vi.fn(),
  onImportFile: vi.fn(),
  onRestoreLastKnownGoodSave: vi.fn(),
  onTryAgain: vi.fn(),
})

describe("Player Data Recovery", () => {
  it("explains unreadable data without erasing it or inventing a known-good save", async () => {
    render(
      <PlayerDataRecovery
        mode="unreadable-data"
        activity={null}
        hasLastKnownGoodSave={false}
        issue={null}
        notice={null}
        pendingImportSource={null}
        preview={null}
        resetReview={null}
        {...unreadableDataHandlers}
      />,
    )

    expect(screen.getByRole("main")).toHaveAttribute(
      "data-slot",
      "mapache-screen",
    )
    expect(screen.getByRole("main")).toHaveClass(
      "min-h-[100dvh]",
      "[--mapache-screen-spacing:1rem]",
      "sm:[--mapache-screen-spacing:2rem]",
    )
    const heading = screen.getByRole("heading", {
      name: "Your Saved Data Needs Attention",
    })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(screen.getByText(/Nothing has been erased\./)).toBeVisible()
    expect(
      screen.getByText(/No last known-good save is available\./),
    ).toBeVisible()
    expect(
      screen.queryByRole("button", {
        name: "Restore Last Known-Good Save",
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Export Unreadable Data" }),
    ).toBeEnabled()
    expect(
      screen.queryByRole("button", { name: "Start Fresh" }),
    ).not.toBeInTheDocument()
  })

  it("accepts a selected JSON backup only through the hidden recovery input", () => {
    const onImportFile = vi.fn()
    render(
      <PlayerDataRecovery
        mode="unreadable-data"
        activity={null}
        hasLastKnownGoodSave={false}
        issue={null}
        notice={null}
        pendingImportSource={null}
        preview={null}
        resetReview={null}
        {...unreadableDataHandlers}
        onImportFile={onImportFile}
      />,
    )
    const file = new File(["{}"], "wayvm-backup.json", {
      type: "application/json",
    })
    const recoveryInput = screen.getByLabelText(
      "Choose WAYVM JSON backup for recovery",
    )
    const clickRecoveryInput = vi.spyOn(recoveryInput, "click")

    fireEvent.click(screen.getByRole("button", { name: "Import Backup" }))
    expect(clickRecoveryInput).toHaveBeenCalledOnce()
    fireEvent.change(recoveryInput, { target: { files: [file] } })

    expect(onImportFile).toHaveBeenCalledWith(file)
  })

  it("reviews a known-good save and restores focus to its initiating action after cancellation", async () => {
    const onCancelImport = vi.fn()
    const onRestoreLastKnownGoodSave = vi.fn()
    const { rerender } = render(
      <PlayerDataRecovery
        mode="unreadable-data"
        activity={null}
        hasLastKnownGoodSave
        issue={null}
        notice={null}
        pendingImportSource={null}
        preview={null}
        resetReview={null}
        {...unreadableDataHandlers}
        onCancelImport={onCancelImport}
        onRestoreLastKnownGoodSave={onRestoreLastKnownGoodSave}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Restore Last Known-Good Save" }),
    )
    expect(onRestoreLastKnownGoodSave).toHaveBeenCalledOnce()
    rerender(
      <PlayerDataRecovery
        mode="unreadable-data"
        activity={null}
        hasLastKnownGoodSave
        issue={null}
        notice={null}
        pendingImportSource="last-known-good"
        preview={preview}
        resetReview={null}
        {...unreadableDataHandlers}
        onCancelImport={onCancelImport}
        onRestoreLastKnownGoodSave={onRestoreLastKnownGoodSave}
      />,
    )
    expect(
      screen.getByText(/unreadable current save will be preserved/),
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancelImport).toHaveBeenCalledOnce()
    rerender(
      <PlayerDataRecovery
        mode="unreadable-data"
        activity={null}
        hasLastKnownGoodSave
        issue={null}
        notice={null}
        pendingImportSource={null}
        preview={null}
        resetReview={null}
        {...unreadableDataHandlers}
        onCancelImport={onCancelImport}
        onRestoreLastKnownGoodSave={onRestoreLastKnownGoodSave}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Restore Last Known-Good Save",
        }),
      ).toHaveFocus(),
    )
  })

  it("reviews complete erasure and returns focus to Delete All Data after cancellation", async () => {
    const resetReview = Object.freeze({
      resetKind: "delete-all-data",
      confirmationId: "recovery-delete-review",
    }) satisfies PlayerDataResetReview
    const onCancelReset = vi.fn()
    const { rerender } = render(
      <PlayerDataRecovery
        mode="unreadable-data"
        activity={null}
        hasLastKnownGoodSave={false}
        issue={null}
        notice={null}
        pendingImportSource={null}
        preview={null}
        resetReview={null}
        {...unreadableDataHandlers}
        onCancelReset={onCancelReset}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Delete All Data" }))
    rerender(
      <PlayerDataRecovery
        mode="unreadable-data"
        activity={null}
        hasLastKnownGoodSave={false}
        issue={null}
        notice={null}
        pendingImportSource={null}
        preview={null}
        resetReview={resetReview}
        {...unreadableDataHandlers}
        onCancelReset={onCancelReset}
      />,
    )
    expect(
      screen.getByRole("button", { name: "Delete All Data" }),
    ).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onCancelReset).toHaveBeenCalledOnce()
    rerender(
      <PlayerDataRecovery
        mode="unreadable-data"
        activity={null}
        hasLastKnownGoodSave={false}
        issue={null}
        notice={null}
        pendingImportSource={null}
        preview={null}
        resetReview={null}
        {...unreadableDataHandlers}
        onCancelReset={onCancelReset}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Delete All Data" }),
      ).toHaveFocus(),
    )
  })

  it("limits a loading-origin storage failure to a retry and focuses new errors", async () => {
    const { rerender } = render(
      <PlayerDataRecovery
        mode="storage-unavailable"
        activity={null}
        canExportCurrentData={false}
        canReturnWithoutNewChanges={false}
        issue={null}
        notice={null}
        onExportCurrentData={vi.fn()}
        onReturnWithoutNewChanges={vi.fn()}
        onTryAgain={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("heading", {
        name: "Progress Cannot Be Saved Reliably",
      }),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Try Again" })).toBeEnabled()
    expect(
      screen.queryByRole("button", { name: "Export Current Data" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Return Without New Changes" }),
    ).not.toBeInTheDocument()

    rerender(
      <PlayerDataRecovery
        mode="storage-unavailable"
        activity="Creating backup…"
        canExportCurrentData
        canReturnWithoutNewChanges
        issue="Browser download failed"
        notice={null}
        onExportCurrentData={vi.fn()}
        onReturnWithoutNewChanges={vi.fn()}
        onTryAgain={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus())
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Browser download failed",
    )
    expect(screen.getByRole("status")).toHaveTextContent("Creating backup…")
    expect(screen.getByRole("button", { name: "Try Again" })).toBeDisabled()
  })
})

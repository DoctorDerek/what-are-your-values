import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Recovery from "./Recovery"

const preview = Object.freeze({
  exportedAt: "2026-07-29T12:34:56.000Z",
  sourceAppVersion: "0.1.0",
  sourceBuild: "recovery-build",
  saveSchemaVersion: 1,
  canonicalCatalogVersion: "pvcs-2011-100-v1",
  totalComparisons: 42,
  currentCycle: 3,
  customValueCount: 2,
  activeValueCount: 102,
  activePairCycleSize: 5151,
  deckRevision: 2,
  progressGeneration: 1,
  unlockedAchievementCount: 4,
  achievementProgressGeneration: 1,
  locale: "en",
  replacesCurrentLocalData: true,
}) satisfies WayvmImportPreview

function renderRecovery(
  overrides: Partial<Parameters<typeof Recovery>[0]> = {},
) {
  const props = {
    activity: null,
    hasCapturedData: true,
    hasLastKnownGoodSave: false,
    importSource: null,
    issue: null,
    notice: null,
    preview: null,
    onCancelImport: vi.fn(),
    onConfirmImport: vi.fn(),
    onDeleteAllData: vi.fn(),
    onExportUnreadableData: vi.fn(),
    onImportFile: vi.fn(),
    onRestoreLastKnownGoodSave: vi.fn(),
    ...overrides,
  } satisfies Parameters<typeof Recovery>[0]

  render(<Recovery {...props} />)

  return props
}

describe("Recovery", () => {
  it("preserves the generic failure surface when no unreadable records were captured", () => {
    renderRecovery({ hasCapturedData: false })

    expect(
      screen.getByRole("heading", {
        name: "We couldn’t safely load your values.",
      }),
    ).toBeVisible()
    expect(
      screen.getByText(
        "Your saved data was left unchanged. Reload this page to try again.",
      ),
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Delete All Data" }),
    ).not.toBeInTheDocument()
  })

  it("offers exact non-destructive recovery actions and a bounded local backup picker", () => {
    const props = renderRecovery()
    const file = new File(['["wayvm-export"]'], "wayvm-backup.json", {
      type: "application/json",
    })

    expect(
      screen.getByRole("heading", {
        name: "Your Saved Data Needs Attention",
      }),
    ).toBeVisible()
    expect(screen.getByText(/Nothing has been erased\./)).toBeVisible()
    expect(
      screen.getByText(/No last known-good save is available\./),
    ).toBeVisible()
    expect(screen.getByText(/not an importable player backup\./)).toBeVisible()

    fireEvent.click(
      screen.getByRole("button", { name: "Export Unreadable Data" }),
    )
    fireEvent.change(screen.getByLabelText("Import Backup"), {
      target: { files: [file] },
    })

    expect(props.onExportUnreadableData).toHaveBeenCalledOnce()
    expect(props.onImportFile).toHaveBeenCalledWith(file)
  })

  it("offers the retained last-known-good save when one exists", () => {
    const props = renderRecovery({ hasLastKnownGoodSave: true })

    fireEvent.click(
      screen.getByRole("button", {
        name: "Restore Last Known-Good Save",
      }),
    )

    expect(props.onRestoreLastKnownGoodSave).toHaveBeenCalledOnce()
    expect(
      screen.queryByText(/No last known-good save is available\./),
    ).not.toBeInTheDocument()
  })

  it("requires fresh acknowledgment before complete erasure", () => {
    const props = renderRecovery()
    const deleteButton = screen.getByRole("button", {
      name: "Delete All Data",
    })

    expect(deleteButton).toBeDisabled()
    fireEvent.click(
      screen.getByLabelText("I understand that this cannot be undone."),
    )
    expect(deleteButton).toBeEnabled()
    fireEvent.click(deleteButton)

    expect(props.onDeleteAllData).toHaveBeenCalledWith(true)
  })

  it("uses exact retained-save confirmation copy for its validated preview", () => {
    const props = renderRecovery({
      hasLastKnownGoodSave: true,
      importSource: "last-known-good",
      preview,
    })

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
    fireEvent.click(screen.getByRole("button", { name: "Cancel Import" }))

    expect(props.onConfirmImport).toHaveBeenCalledOnce()
    expect(props.onCancelImport).toHaveBeenCalledOnce()
  })

  it("announces recovery activity and failures while disabling mutation", () => {
    renderRecovery({
      activity: "Replacing unreadable data…",
      issue: "Replacement failed",
      notice: "Diagnostic data exported.",
      preview,
      importSource: "selected-backup",
    })

    expect(screen.getByText("Replacing unreadable data…")).toBeVisible()
    expect(screen.getByRole("alert")).toHaveTextContent("Replacement failed")
    expect(screen.getByRole("button", { name: "Import Backup" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel Import" })).toBeDisabled()
  })
})

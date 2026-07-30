import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DataManagement from "./DataManagement"

const preview = Object.freeze({
  exportedAt: "2026-07-29T12:34:56.000Z",
  sourceAppVersion: "0.1.0",
  sourceBuild: "abc123",
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

function renderDataManagement(
  overrides: Partial<Parameters<typeof DataManagement>[0]> = {},
) {
  const props = {
    activity: null,
    canDeleteCustomValues: false,
    issue: null,
    notice: null,
    preview: null,
    resetKind: null,
    onCancelImport: vi.fn(),
    onCancelReset: vi.fn(),
    onClose: vi.fn(),
    onConfirmImport: vi.fn(),
    onConfirmReset: vi.fn(),
    onExport: vi.fn(),
    onImportFile: vi.fn(),
    onOpenReset: vi.fn(),
    ...overrides,
  } satisfies Parameters<typeof DataManagement>[0]

  render(<DataManagement {...props} />)

  return props
}

describe("Data Management", () => {
  it("offers complete private export and bounded local import actions", () => {
    const props = renderDataManagement()
    const file = new File(['["wayvm-export"]'], "wayvm-backup.json", {
      type: "application/json",
    })

    fireEvent.click(screen.getByRole("button", { name: "Export Data" }))
    fireEvent.change(screen.getByLabelText("Import Data"), {
      target: { files: [file] },
    })
    fireEvent.click(screen.getByRole("button", { name: "Back to Your Values" }))

    expect(props.onExport).toHaveBeenCalledOnce()
    expect(props.onImportFile).toHaveBeenCalledWith(file)
    expect(props.onClose).toHaveBeenCalledOnce()
    expect(
      screen.getByText(/Importing stays local to this device\./),
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Delete All Custom Values" }),
    ).toBeDisabled()
    expect(
      screen.getByText("There are no Custom Values to delete."),
    ).toBeVisible()
  })

  it("shows validated replacement facts before accepting explicit confirmation", () => {
    const props = renderDataManagement({ preview })

    expect(screen.getByRole("heading", { name: "Review Import" })).toBeVisible()
    expect(screen.getByText("102 active · 2 custom")).toBeVisible()
    expect(screen.getByText("42 comparisons · Cycle 3")).toBeVisible()
    expect(screen.getByText("4 unlocked")).toBeVisible()
    expect(screen.getByText(/Version 0\.1\.0 · Build abc123/)).toBeVisible()
    expect(
      screen.getByText(/A recovery backup is created first\./),
    ).toBeVisible()

    fireEvent.click(
      screen.getByRole("button", { name: "Replace Current Data" }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Cancel Import" }))

    expect(props.onConfirmImport).toHaveBeenCalledOnce()
    expect(props.onCancelImport).toHaveBeenCalledOnce()
  })

  it("announces activity outcomes and prevents navigation during replacement", () => {
    renderDataManagement({
      activity: "Replacing local data…",
      issue: "Import replacement failed",
      notice: "Your private backup is ready.",
      preview,
    })

    expect(screen.getByText("Replacing local data…")).toBeVisible()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Import replacement failed",
    )
    expect(
      screen.getByRole("button", { name: "Replace Current Data" }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Back to Your Values" }),
    ).toBeDisabled()
  })

  it("routes each available destructive action into its own review flow", () => {
    const props = renderDataManagement({ canDeleteCustomValues: true })

    fireEvent.click(
      screen.getByRole("button", { name: "Delete All Custom Values" }),
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Reset Levels & Experience" }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Reset Achievements" }))
    fireEvent.click(screen.getByRole("button", { name: "Delete All Data" }))

    expect(props.onOpenReset.mock.calls).toEqual([
      ["delete-all-custom-values"],
      ["reset-levels-and-experience"],
      ["reset-achievements"],
      ["delete-all-data"],
    ])
  })

  it("presents exact scoped reset consequences with export cancel and confirmation", () => {
    const props = renderDataManagement({
      canDeleteCustomValues: true,
      resetKind: "reset-levels-and-experience",
    })

    expect(
      screen.getByRole("heading", { name: "Reset Levels & Experience?" }),
    ).toBeVisible()
    expect(
      screen.getByText(/returns every active value to Level 1 with 0 XP/),
    ).toBeVisible()
    expect(
      screen.getByText(/keeps your Custom Value definitions, achievements/),
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Export Data" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Reset Levels & Experience" }),
    )

    expect(props.onExport).toHaveBeenCalledOnce()
    expect(props.onCancelReset).toHaveBeenCalledOnce()
    expect(props.onConfirmReset).toHaveBeenCalledWith(false)
  })

  it("keeps Delete All Data unavailable until the player checks the fresh acknowledgment", () => {
    const props = renderDataManagement({ resetKind: "delete-all-data" })
    const deleteButton = screen.getByRole("button", {
      name: "Delete All Data",
    })

    expect(deleteButton).toBeDisabled()
    fireEvent.click(
      screen.getByLabelText("I understand that this cannot be undone."),
    )
    expect(deleteButton).toBeEnabled()
    fireEvent.click(deleteButton)

    expect(props.onConfirmReset).toHaveBeenCalledWith(true)
  })
})

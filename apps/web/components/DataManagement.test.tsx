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
    issue: null,
    notice: null,
    preview: null,
    onCancelImport: vi.fn(),
    onClose: vi.fn(),
    onConfirmImport: vi.fn(),
    onExport: vi.fn(),
    onImportFile: vi.fn(),
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
})

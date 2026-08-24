import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PlayerDataImportPreview from "./PlayerDataImportPreview"

const preview = Object.freeze({
  exportedAt: "2026-08-06T12:34:56.000Z",
  sourceAppVersion: "0.1.0",
  sourceBuild: "abc123",
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

function getPreviewValue(label: string) {
  const term = screen.getByText(label)
  const fact = term.closest("div")
  if (!fact) throw new Error(`Preview fact is unavailable: ${label}`)
  return within(fact).getByRole("definition")
}

describe("Player Data Import Preview", () => {
  it("shows every validated identity required before replacement", async () => {
    render(
      <PlayerDataImportPreview
        isBusy={false}
        preview={preview}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Review Import" }),
      ).toHaveFocus(),
    )
    const previewFacts = screen
      .getByText("Backup Created")
      .closest("div")?.parentElement
    expect(previewFacts).toHaveClass("grid-cols-1", "xl:grid-cols-2")
    expect(previewFacts).not.toHaveClass("sm:grid-cols-2")
    expect(screen.getByRole("time")).toHaveAttribute(
      "datetime",
      preview.exportedAt,
    )
    expect(getPreviewValue("Source Application")).toHaveTextContent(
      "Version 0.1.0",
    )
    expect(getPreviewValue("Source Build")).toHaveTextContent("abc123")
    expect(getPreviewValue("Save Schema")).toHaveTextContent("Version 1")
    expect(getPreviewValue("Total Comparisons")).toHaveTextContent("42")
    expect(getPreviewValue("Canonical Catalog")).toHaveTextContent(
      "pvcs-2011-100-v1",
    )
    expect(getPreviewValue("Included Values")).toHaveTextContent("100")
    expect(getPreviewValue("Custom Values")).toHaveTextContent("2")
    expect(getPreviewValue("Active Values")).toHaveTextContent("102")
    expect(getPreviewValue("Current Cycle")).toHaveTextContent("3")
    expect(getPreviewValue("Cycle Pairings")).toHaveTextContent("5151")
    expect(getPreviewValue("Deck Revision")).toHaveTextContent("2")
    expect(getPreviewValue("Progress Generation")).toHaveTextContent("1")
    expect(getPreviewValue("Achievements")).toHaveTextContent("4")
    expect(
      getPreviewValue("Achievement Progress Generation"),
    ).toHaveTextContent("1")
    expect(getPreviewValue("Language")).toHaveTextContent("en")
    expect(getPreviewValue("Replacement")).toHaveTextContent(
      "Replaces current data on this device",
    )
    expect(
      screen.getByText(/A local safety backup will be created first\./),
    ).toBeVisible()
  })

  it("requires an explicit enabled replacement action and preserves cancellation", () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const { rerender } = render(
      <PlayerDataImportPreview
        isBusy={false}
        preview={preview}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    fireEvent.click(screen.getByRole("button", { name: "Import & Replace" }))
    const actionLayout = screen.getByRole("button", {
      name: "Cancel",
    }).parentElement
    expect(actionLayout).toHaveClass("flex-col", "xl:flex-row")
    expect(actionLayout).not.toHaveClass("sm:flex-row")
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).toHaveBeenCalledOnce()

    rerender(
      <PlayerDataImportPreview
        isBusy
        preview={preview}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Import & Replace" }),
    ).toBeDisabled()
  })

  it("adapts the validated preview language without changing its evidence", () => {
    render(
      <PlayerDataImportPreview
        confirmLabel="Restore Save"
        isBusy={false}
        preview={preview}
        title="Restore Last Known-Good Save?"
        warning="Restore the last known-good save? The unreadable current save will be preserved until restoration succeeds."
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("heading", {
        name: "Restore Last Known-Good Save?",
      }),
    ).toBeVisible()
    expect(
      screen.getByText(
        "Restore the last known-good save? The unreadable current save will be preserved until restoration succeeds.",
      ),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Restore Save" })).toBeEnabled()
    expect(getPreviewValue("Total Comparisons")).toHaveTextContent("42")
  })
})

import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { WAYVM_IMPORT_FILE_ACCEPT } from "@/lib/PlayerDataFiles"
import DataManagement from "./DataManagement"

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
  it("offers exact private export and bounded local import actions", async () => {
    const props = renderDataManagement()
    const file = new File(['["wayvm-export"]'], "wayvm-backup.json", {
      type: "application/json",
    })

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Import & Export", level: 1 }),
      ).toHaveFocus(),
    )
    expect(
      screen.getByText(/Export a JSON backup to keep a portable copy/),
    ).toBeVisible()
    expect(
      screen.getByText(/Exporting does not upload your data to us\./),
    ).toBeVisible()
    expect(
      screen.getByText(/show you a preview before replacing data/),
    ).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Export Data" }))
    const importInput = screen.getByLabelText("Choose WAYVM JSON backup")
    expect(importInput).toHaveAttribute("accept", WAYVM_IMPORT_FILE_ACCEPT)
    fireEvent.change(importInput, { target: { files: [file] } })
    fireEvent.click(screen.getByRole("button", { name: "Back to Your Values" }))

    expect(props.onExport).toHaveBeenCalledOnce()
    expect(props.onImportFile).toHaveBeenCalledWith(file)
    expect(props.onClose).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole("button", { name: "Reset Achievements" }),
    ).not.toBeInTheDocument()
  })

  it("returns focus to backup selection after cancelling a reviewed import", async () => {
    function CancellationHarness() {
      const [candidatePreview, setCandidatePreview] =
        useState<WayvmImportPreview | null>(preview)

      return (
        <DataManagement
          activity={null}
          issue={null}
          notice={
            candidatePreview
              ? null
              : "Import cancelled. Your data was not changed."
          }
          preview={candidatePreview}
          onCancelImport={() => setCandidatePreview(null)}
          onClose={vi.fn()}
          onConfirmImport={vi.fn()}
          onExport={vi.fn()}
          onImportFile={vi.fn()}
        />
      )
    }

    render(<CancellationHarness />)
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }))

    expect(
      await screen.findByText("Import cancelled. Your data was not changed."),
    ).toBeVisible()
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Choose Backup" }),
      ).toHaveFocus(),
    )
  })

  it("focuses recoverable issues and disables every action while busy", async () => {
    renderDataManagement({
      activity: "Checking backup…",
      issue:
        "This file is not a valid WAYVM backup. Your data was not changed.",
    })

    const issue = screen.getByRole("alert")
    await waitFor(() => expect(issue).toHaveFocus())
    expect(screen.getByRole("status")).toHaveTextContent("Checking backup…")
    expect(screen.getByRole("button", { name: "Export Data" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Choose Backup" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Back to Your Values" }),
    ).toBeDisabled()
  })

  it("shows the reviewed backup without leaving import and export scope", () => {
    const props = renderDataManagement({ preview })

    expect(screen.getByRole("heading", { name: "Review Import" })).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Import & Replace" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(props.onConfirmImport).toHaveBeenCalledOnce()
    expect(props.onCancelImport).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole("heading", { name: "Reset or Delete" }),
    ).not.toBeInTheDocument()
  })
})

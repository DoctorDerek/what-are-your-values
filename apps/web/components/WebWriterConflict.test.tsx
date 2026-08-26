import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import WebWriterConflict from "@/components/WebWriterConflict"
import { webWriterConflictCopy } from "@/lib/WebWriterConflictCopy"

function renderWebWriterConflict({
  isExportPending = false,
  issue = null,
  notice = null,
}: {
  readonly isExportPending?: boolean
  readonly issue?: string | null
  readonly notice?: string | null
} = {}) {
  const onExportThisTab = vi.fn()
  const onLoadLatest = vi.fn()
  const rendered = render(
    <WebWriterConflict
      isExportPending={isExportPending}
      issue={issue}
      notice={notice}
      onExportThisTab={onExportThisTab}
      onLoadLatest={onLoadLatest}
    />,
  )

  return Object.freeze({ onExportThisTab, onLoadLatest, ...rendered })
}

describe("Web Writer Conflict", () => {
  it("presents the exact conflict contract and focuses its heading", async () => {
    renderWebWriterConflict()

    expect(screen.getByRole("main")).toHaveAttribute(
      "data-slot",
      "mapache-screen",
    )
    expect(screen.getByRole("main")).toHaveClass(
      "min-h-[100dvh]",
      "[--mapache-screen-spacing:1rem]",
      "xl:[--mapache-screen-spacing:2rem]",
    )
    const heading = screen.getByRole("heading", {
      name: webWriterConflictCopy.title,
    })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(screen.getByText(webWriterConflictCopy.message)).toBeVisible()
    expect(
      screen.getByRole("button", {
        name: webWriterConflictCopy.loadLatestAction,
      }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", {
        name: webWriterConflictCopy.exportThisTabAction,
      }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", {
        name: webWriterConflictCopy.cancelAction,
      }),
    ).toBeEnabled()
  })

  it("routes load and export through distinct actions", () => {
    const { onExportThisTab, onLoadLatest } = renderWebWriterConflict()

    fireEvent.click(
      screen.getByRole("button", {
        name: webWriterConflictCopy.loadLatestAction,
      }),
    )
    fireEvent.click(
      screen.getByRole("button", {
        name: webWriterConflictCopy.exportThisTabAction,
      }),
    )

    expect(onLoadLatest).toHaveBeenCalledOnce()
    expect(onExportThisTab).toHaveBeenCalledOnce()
  })

  it("collapses and restores options without granting write access", async () => {
    renderWebWriterConflict()

    fireEvent.click(
      screen.getByRole("button", {
        name: webWriterConflictCopy.cancelAction,
      }),
    )

    expect(
      screen.queryByRole("button", {
        name: webWriterConflictCopy.loadLatestAction,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", {
        name: webWriterConflictCopy.exportThisTabAction,
      }),
    ).not.toBeInTheDocument()
    const reviewOptionsButton = screen.getByRole("button", {
      name: webWriterConflictCopy.reviewOptionsAction,
    })
    await waitFor(() => expect(reviewOptionsButton).toHaveFocus())

    fireEvent.click(reviewOptionsButton)
    const loadLatestButton = screen.getByRole("button", {
      name: webWriterConflictCopy.loadLatestAction,
    })
    await waitFor(() => expect(loadLatestButton).toHaveFocus())
  })

  it("announces pending, successful, and failed export states", async () => {
    const rendered = renderWebWriterConflict({ isExportPending: true })

    expect(screen.getByRole("status")).toHaveTextContent(
      webWriterConflictCopy.exportActivity,
    )
    screen
      .getAllByRole("button")
      .forEach((button) => expect(button).toBeDisabled())

    rendered.rerender(
      <WebWriterConflict
        isExportPending={false}
        issue="Backup failed"
        notice="Backup ready"
        onExportThisTab={rendered.onExportThisTab}
        onLoadLatest={rendered.onLoadLatest}
      />,
    )

    expect(screen.getByRole("status")).toHaveTextContent("Backup ready")
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus())
    expect(screen.getByRole("alert")).toHaveTextContent("Backup failed")
  })
})

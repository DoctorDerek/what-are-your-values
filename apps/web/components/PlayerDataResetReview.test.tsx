import {
  DELETE_ALL_DATA_ACKNOWLEDGMENT,
  type PlayerDataResetReview as PlayerDataResetReviewState,
} from "@game/machines/src/PlayerDataReset"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PlayerDataResetReview from "./PlayerDataResetReview"

function renderResetReview({
  isBusy = false,
  review = Object.freeze({
    resetKind: "reset-levels-and-experience",
    confirmationId: "levels-review",
  }),
}: {
  isBusy?: boolean
  review?: PlayerDataResetReviewState
} = {}) {
  const props = {
    isBusy,
    review,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    onExport: vi.fn(),
  }

  render(<PlayerDataResetReview {...props} />)
  return props
}

describe("Player Data Reset Review", () => {
  it("focuses one exact scoped review and offers backup cancellation and confirmation", async () => {
    const props = renderResetReview()

    const heading = screen.getByRole("heading", {
      name: "Reset Levels & Experience?",
    })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(
      screen.getByText(/Your current value ranking restarts/),
    ).toBeVisible()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Export Data" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Reset Levels & Experience" }),
    )

    expect(props.onExport).toHaveBeenCalledOnce()
    expect(props.onCancel).toHaveBeenCalledOnce()
    expect(props.onConfirm).toHaveBeenCalledWith(props.review)
  })

  it("requires explicit acknowledgment before complete erasure", async () => {
    const review = Object.freeze({
      resetKind: "delete-all-data",
      confirmationId: "complete-erasure-review",
    }) satisfies PlayerDataResetReviewState
    const props = renderResetReview({ review })

    const confirmation = screen.getByRole("button", {
      name: "Delete All Data",
    })
    expect(confirmation).toBeDisabled()
    expect(
      screen.getByText(/This permanently removes all WAYVM player data/),
    ).toBeVisible()

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: DELETE_ALL_DATA_ACKNOWLEDGMENT,
      }),
    )
    expect(confirmation).toBeEnabled()
    fireEvent.click(confirmation)

    expect(props.onConfirm).toHaveBeenCalledWith(review)
  })

  it("locks every review action while a durable operation is active", () => {
    renderResetReview({ isBusy: true })

    expect(screen.getByRole("button", { name: "Export Data" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Reset Levels & Experience" }),
    ).toBeDisabled()
  })
})

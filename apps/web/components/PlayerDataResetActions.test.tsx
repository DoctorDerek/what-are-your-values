import type { PlayerDataResetKind } from "@game/machines/src/PlayerDataReset"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import PlayerDataResetActions from "./PlayerDataResetActions"

const actionCases = Object.freeze([
  ["Delete All Custom Values", "delete-all-custom-values"],
  ["Reset Levels & Experience", "reset-levels-and-experience"],
  ["Reset Achievements", "reset-achievements"],
  ["Delete All Data", "delete-all-data"],
]) satisfies readonly (readonly [string, PlayerDataResetKind])[]

describe("Player Data Reset Actions", () => {
  it("offers four distinct scopes and never collapses them into Reset", () => {
    const onRequestReset = vi.fn()
    render(
      <PlayerDataResetActions
        customValueCount={2}
        isBusy={false}
        onRequestReset={onRequestReset}
      />,
    )

    expect(
      screen.getByRole("heading", { name: "Reset or Delete" }),
    ).toBeVisible()
    expect(screen.getByText(/keeping canonical value progress/)).toBeVisible()
    expect(screen.getByText(/keeping your values and ranking/)).toBeVisible()
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull()

    for (const [actionLabel, resetKind] of actionCases) {
      const action = screen.getByRole("button", { name: actionLabel })
      expect(action).toBeEnabled()
      fireEvent.click(action)
      expect(onRequestReset).toHaveBeenLastCalledWith(resetKind, action.id)
    }
  })

  it("keeps unavailable Custom Value deletion visible without disabling other scopes", () => {
    render(
      <PlayerDataResetActions
        customValueCount={0}
        isBusy={false}
        onRequestReset={vi.fn()}
      />,
    )

    expect(screen.getByText("No Custom Values to delete.")).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Delete All Custom Values" }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Reset Levels & Experience" }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", { name: "Reset Achievements" }),
    ).toBeEnabled()
    expect(
      screen.getByRole("button", { name: "Delete All Data" }),
    ).toBeEnabled()
  })

  it("locks every destructive entry point while another data operation is active", () => {
    render(
      <PlayerDataResetActions
        customValueCount={2}
        isBusy
        onRequestReset={vi.fn()}
      />,
    )

    for (const [actionLabel] of actionCases) {
      expect(screen.getByRole("button", { name: actionLabel })).toBeDisabled()
    }
  })
})

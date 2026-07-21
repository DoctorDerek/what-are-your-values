import { getValueDisplayName } from "@game/data/src/Value"
import { rankValues } from "@game/data/src/ValueRanking"
import {
  createBattleCycleCandidate,
  createInitialBattleCycle,
} from "@game/machines/src/BattleCycle"
import { projectScheduledPair } from "@game/machines/src/PairScheduler"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Hub from "./Hub"

describe("Hub Component Integration", () => {
  it("withholds an unearned Top Five until the first comparison", () => {
    const battleCycle = createInitialBattleCycle("empty-hub-seed")

    render(
      <Hub
        rankedValues={rankValues(
          battleCycle.activeDeck,
          battleCycle.progressById,
        )}
        onSeeAllValues={vi.fn()}
        onStartBattle={vi.fn()}
      />,
    )

    expect(
      screen.getByText("Keep comparing values to reveal your Top Five."),
    ).toBeVisible()
    expect(screen.queryByText("#1 Acceptance")).not.toBeInTheDocument()
    expect(screen.queryByText(/Avatar|Phase C/)).not.toBeInTheDocument()
  })

  it("renders the exact evidence ranking and starts a battle", () => {
    const onSeeAllValues = vi.fn()
    const onStartBattle = vi.fn()
    const initialBattleCycle = createInitialBattleCycle("ranked-hub-seed")
    const [winnerId] = projectScheduledPair(
      initialBattleCycle.activeDeck,
      initialBattleCycle.scheduler,
    ).pair
    const battleCycle = createBattleCycleCandidate({
      battleCycle: initialBattleCycle,
      winnerId,
      expectedScheduler: initialBattleCycle.scheduler,
    })
    const winner = battleCycle.activeDeck.values.find(
      ({ id }) => id === winnerId,
    )
    if (!winner) {
      throw new Error("Winner definition is missing")
    }

    render(
      <Hub
        rankedValues={rankValues(
          battleCycle.activeDeck,
          battleCycle.progressById,
        )}
        onSeeAllValues={onSeeAllValues}
        onStartBattle={onStartBattle}
      />,
    )

    expect(screen.getByText(`#1 ${getValueDisplayName(winner)}`)).toBeVisible()
    expect(screen.getByText("LVL 2")).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "See All Values" }))
    expect(onSeeAllValues).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("button", { name: "Battle" }))
    expect(onStartBattle).toHaveBeenCalledTimes(1)
  })
})

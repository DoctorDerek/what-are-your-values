import { getValueDisplayName } from "@game/data/src/Value"
import { rankValues } from "@game/data/src/ValueRanking"
import {
  createBattleCycleCandidate,
  createInitialBattleCycle,
} from "@game/machines/src/BattleCycle"
import { projectScheduledPair } from "@game/machines/src/PairScheduler"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import AllValues from "./AllValues"

describe("All Values Component Integration", () => {
  it("shows the complete fresh canonical ranking without fabricating a Top Five", () => {
    const battleCycle = createInitialBattleCycle("all-values-fresh-seed")
    const rankedValues = rankValues(
      battleCycle.activeDeck,
      battleCycle.progressById,
    )

    render(<AllValues rankedValues={rankedValues} onClose={vi.fn()} />)

    expect(
      screen.getByRole("heading", { name: "All Values", level: 1 }),
    ).toBeVisible()
    expect(screen.getByText("100 Active Values")).toBeVisible()
    expect(screen.getAllByRole("listitem")).toHaveLength(100)
    expect(screen.queryByText("Top Five")).not.toBeInTheDocument()
    expect(
      screen.getByText(
        `What ${getValueDisplayName(rankedValues[0].definition)} means`,
      ),
    ).toBeVisible()
  })

  it("filters without reordering ranks and restores the complete list", () => {
    const battleCycle = createInitialBattleCycle("all-values-search-seed")
    const rankedValues = rankValues(
      battleCycle.activeDeck,
      battleCycle.progressById,
    )
    const expectedMatches = rankedValues.filter(({ definition }) =>
      getValueDisplayName(definition).toLocaleLowerCase().includes("health"),
    )

    render(<AllValues rankedValues={rankedValues} onClose={vi.fn()} />)

    const search = screen.getByRole("searchbox", { name: "Search Values" })
    fireEvent.change(search, { target: { value: "health" } })

    expect(screen.getAllByRole("listitem")).toHaveLength(expectedMatches.length)
    expectedMatches.forEach(({ rank, definition }) => {
      expect(screen.getByLabelText(`Rank ${rank}`)).toBeVisible()
      expect(screen.getByText(getValueDisplayName(definition))).toBeVisible()
    })

    fireEvent.change(search, { target: { value: "" } })
    expect(screen.getAllByRole("listitem")).toHaveLength(100)
  })

  it("marks the earned Top Five and closes without changing data", () => {
    const onClose = vi.fn()
    const initialBattleCycle = createInitialBattleCycle(
      "all-values-earned-seed",
    )
    const [winnerId] = projectScheduledPair(
      initialBattleCycle.activeDeck,
      initialBattleCycle.scheduler,
    ).pair
    const battleCycle = createBattleCycleCandidate({
      battleCycle: initialBattleCycle,
      winnerId,
      expectedScheduler: initialBattleCycle.scheduler,
    })

    render(
      <AllValues
        rankedValues={rankValues(
          battleCycle.activeDeck,
          battleCycle.progressById,
        )}
        onClose={onClose}
      />,
    )

    expect(screen.getAllByText("Top Five")).toHaveLength(5)
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("closes through Escape without changing the visible ranking first", () => {
    const onClose = vi.fn()
    const battleCycle = createInitialBattleCycle("all-values-escape-seed")

    render(
      <AllValues
        rankedValues={rankValues(
          battleCycle.activeDeck,
          battleCycle.progressById,
        )}
        onClose={onClose}
      />,
    )

    expect(screen.getAllByRole("listitem")).toHaveLength(100)
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

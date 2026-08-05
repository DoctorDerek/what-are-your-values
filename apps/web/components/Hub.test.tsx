import { getValueDisplayName } from "@game/data/src/Value"
import { rankValues } from "@game/data/src/ValueRanking"
import {
  createBattleCycleCandidate,
  createInitialBattleCycle,
} from "@game/machines/src/BattleCycle"
import { projectScheduledPair } from "@game/machines/src/PairScheduler"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Hub from "./Hub"

describe("Hub Component Integration", () => {
  it("shows every included value alphabetically before the first comparison", () => {
    const battleCycle = createInitialBattleCycle("empty-hub-seed")
    const onBrowseAllValues = vi.fn()
    const onAddCustomValue = vi.fn()
    const onOpenValue = vi.fn()

    render(
      <Hub
        rankedValues={rankValues(
          battleCycle.activeDeck,
          battleCycle.progressById,
        )}
        onBrowseAllValues={onBrowseAllValues}
        onAddCustomValue={onAddCustomValue}
        onOpenValue={onOpenValue}
        onStartBattle={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("heading", { name: "Your Values", level: 1 }),
    ).toBeVisible()
    expect(screen.getByText("Included Values")).toBeVisible()
    expect(screen.getByText(/Not ranked yet\./)).toBeVisible()
    const firstRow = screen.getAllByRole("listitem")[0]
    expect(within(firstRow).getByText("Acceptance")).toBeVisible()
  })

  it("renders all fresh rows without fabricated ranks and exposes the action rail", () => {
    const battleCycle = createInitialBattleCycle("fresh-hub-seed")

    render(
      <Hub
        rankedValues={rankValues(
          battleCycle.activeDeck,
          battleCycle.progressById,
        )}
        onBrowseAllValues={vi.fn()}
        onAddCustomValue={vi.fn()}
        onOpenValue={vi.fn()}
        onStartBattle={vi.fn()}
      />,
    )

    expect(screen.getAllByRole("listitem")).toHaveLength(100)
    expect(screen.queryByText("#1")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Browse All Values" }),
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Add Custom Value" }),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Battle" })).toBeVisible()
  })

  it("renders the earned Top Five and full ranked list after a comparison", () => {
    const onBrowseAllValues = vi.fn()
    const onAddCustomValue = vi.fn()
    const onOpenValue = vi.fn()
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
        onBrowseAllValues={onBrowseAllValues}
        onAddCustomValue={onAddCustomValue}
        onOpenValue={onOpenValue}
        onStartBattle={vi.fn()}
      />,
    )

    expect(screen.getByRole("heading", { name: "Top Five" })).toBeVisible()
    expect(screen.getAllByText("All Other Values")).toHaveLength(2)
    expect(screen.getAllByRole("listitem")).toHaveLength(100)
    expect(
      screen.getByRole("button", {
        name: `Open ${getValueDisplayName(winner)} in All Values`,
      }),
    ).toBeVisible()
    expect(screen.getByText("Level 3")).toBeVisible()
  })

  it("routes action and row presses with stable focus target identifiers", () => {
    const onBrowseAllValues = vi.fn()
    const onAddCustomValue = vi.fn()
    const onOpenValue = vi.fn()
    const battleCycle = createInitialBattleCycle("action-hub-seed")

    render(
      <Hub
        rankedValues={rankValues(
          battleCycle.activeDeck,
          battleCycle.progressById,
        )}
        onBrowseAllValues={onBrowseAllValues}
        onAddCustomValue={onAddCustomValue}
        onOpenValue={onOpenValue}
        onStartBattle={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Browse All Values" }))
    fireEvent.click(screen.getByRole("button", { name: "Add Custom Value" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Open Acceptance in All Values" }),
    )

    expect(onBrowseAllValues).toHaveBeenCalledWith(
      "hub-browse-all-values-button",
    )
    expect(onAddCustomValue).toHaveBeenCalledWith("hub-add-custom-value-button")
    expect(onOpenValue).toHaveBeenCalledWith(
      "pvcs-2011:acceptance",
      "hub-value-pvcs-2011:acceptance-button",
    )
  })
})

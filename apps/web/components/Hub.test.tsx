import { createSeethingSwarmTypographyOnlyAnimalPresentationAdapter } from "@game/data/src/SeethingSwarmAnimalPresentation"
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

const animalPresentationProps = Object.freeze({
  animalPresentationAdapter:
    createSeethingSwarmTypographyOnlyAnimalPresentationAdapter(),
  shouldReduceMotion: false,
})

describe("Hub Component Integration", () => {
  it("shows every included value alphabetically before the first comparison", () => {
    const battleCycle = createInitialBattleCycle("empty-hub-seed")
    const onBrowseAllValues = vi.fn()
    const onAddCustomValue = vi.fn()
    const onOpenValue = vi.fn()

    render(
      <Hub
        {...animalPresentationProps}
        rankedValues={rankValues(
          battleCycle.activeDeck,
          battleCycle.progressById,
        )}
        dataNotice={null}
        onBrowseAllValues={onBrowseAllValues}
        onAddCustomValue={onAddCustomValue}
        onOpenMenu={vi.fn()}
        onOpenValue={onOpenValue}
        onStartBattle={vi.fn()}
      />,
    )

    expect(screen.getByRole("main")).toHaveAttribute(
      "data-slot",
      "mapache-screen",
    )
    expect(screen.getByRole("main")).toHaveClass(
      "min-h-[100dvh]",
      "[--mapache-screen-spacing:1rem]",
      "sm:[--mapache-screen-spacing:2rem]",
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
        {...animalPresentationProps}
        rankedValues={rankValues(
          battleCycle.activeDeck,
          battleCycle.progressById,
        )}
        dataNotice={null}
        onBrowseAllValues={vi.fn()}
        onAddCustomValue={vi.fn()}
        onOpenMenu={vi.fn()}
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
    expect(screen.getByRole("button", { name: "Menu" })).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Achievements" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Import & Export" }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Battle" })).toBeVisible()
    const valueActions = screen.getByRole("navigation", {
      name: "Value actions",
    })
    expect(
      within(valueActions)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Battle", "Browse All Values", "Add Custom Value"])
    expect(
      within(valueActions).queryByRole("button", { name: "Menu" }),
    ).not.toBeInTheDocument()
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
        {...animalPresentationProps}
        rankedValues={rankValues(
          battleCycle.activeDeck,
          battleCycle.progressById,
        )}
        dataNotice={null}
        onBrowseAllValues={onBrowseAllValues}
        onAddCustomValue={onAddCustomValue}
        onOpenMenu={vi.fn()}
        onOpenValue={onOpenValue}
        onStartBattle={vi.fn()}
      />,
    )

    expect(screen.getByRole("heading", { name: "Top Five" })).toBeVisible()
    expect(screen.getAllByText("All Other Values")).toHaveLength(2)
    expect(screen.getAllByRole("listitem")).toHaveLength(100)
    expect(
      screen.getByRole("button", {
        name: `Rank 1. Open ${getValueDisplayName(winner)} in All Values`,
      }),
    ).toBeVisible()
    expect(screen.getByText("Level 3")).toBeVisible()
  })

  it("routes action and row presses with stable focus target identifiers", () => {
    const onBrowseAllValues = vi.fn()
    const onAddCustomValue = vi.fn()
    const onOpenMenu = vi.fn()
    const onOpenValue = vi.fn()
    const battleCycle = createInitialBattleCycle("action-hub-seed")

    render(
      <Hub
        {...animalPresentationProps}
        rankedValues={rankValues(
          battleCycle.activeDeck,
          battleCycle.progressById,
        )}
        dataNotice={null}
        onBrowseAllValues={onBrowseAllValues}
        onAddCustomValue={onAddCustomValue}
        onOpenMenu={onOpenMenu}
        onOpenValue={onOpenValue}
        onStartBattle={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Browse All Values" }))
    fireEvent.click(screen.getByRole("button", { name: "Add Custom Value" }))
    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Open Acceptance in All Values" }),
    )

    expect(onBrowseAllValues).toHaveBeenCalledWith(
      "hub-browse-all-values-button",
    )
    expect(onAddCustomValue).toHaveBeenCalledWith("hub-add-custom-value-button")
    expect(onOpenMenu).toHaveBeenCalledOnce()
    expect(onOpenValue).toHaveBeenCalledWith(
      "pvcs-2011:acceptance",
      "hub-value-pvcs-2011:acceptance-button",
    )
  })

  it("announces a restored backup while keeping every value visible", () => {
    const battleCycle = createInitialBattleCycle("restored-hub-seed")

    render(
      <Hub
        {...animalPresentationProps}
        rankedValues={rankValues(
          battleCycle.activeDeck,
          battleCycle.progressById,
        )}
        dataNotice="Backup restored. Your imported progress is ready."
        onBrowseAllValues={vi.fn()}
        onAddCustomValue={vi.fn()}
        onOpenMenu={vi.fn()}
        onOpenValue={vi.fn()}
        onStartBattle={vi.fn()}
      />,
    )

    expect(
      screen.getByText("Backup restored. Your imported progress is ready."),
    ).toBeVisible()
    expect(screen.getAllByRole("listitem")).toHaveLength(100)
  })
})

import { createActiveDeck } from "@game/data/src/ActiveDeck"
import { createSeethingSwarmTypographyOnlyAnimalPresentationAdapter } from "@game/data/src/SeethingSwarmAnimalPresentation"
import { getValueDisplayName } from "@game/data/src/Value"
import {
  createInitialValueProgress,
  createValueProgress,
} from "@game/data/src/ValueProgress"
import { rankValues } from "@game/data/src/ValueRanking"
import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import NativeHub from "@/components/NativeHub"

const activeDeck = createActiveDeck([])
const animalPresentationProps = Object.freeze({
  animalPresentationAdapter:
    createSeethingSwarmTypographyOnlyAnimalPresentationAdapter(),
  shouldReduceMotion: false,
})

function createUnplayedRankedValues() {
  return rankValues(activeDeck, createInitialValueProgress(activeDeck))
}

function createRankedValuesWithEvidence() {
  const progressById = new Map(createInitialValueProgress(activeDeck))
  const firstValueId = activeDeck.valueIds[0]

  progressById.set(
    firstValueId,
    createValueProgress(firstValueId, {
      totalXp: 4,
      profileWins: 1,
      profileComparisons: 1,
      currentCycleWins: 1,
    }),
  )

  return rankValues(activeDeck, progressById)
}

function createHubCallbacks() {
  return {
    onAddCustomValue: jest.fn(),
    onBrowseAllValues: jest.fn(),
    onOpenAchievements: jest.fn(),
    onOpenDataManagement: jest.fn(),
    onOpenMenu: jest.fn(),
    onOpenValue: jest.fn(),
    onStartBattle: jest.fn(),
  }
}

describe("NativeHub", () => {
  it("supports first-run discovery without presenting source order as a ranking", async () => {
    const callbacks = createHubCallbacks()
    const user = userEvent.setup()
    const rankedValues = createUnplayedRankedValues()
    await render(
      <NativeHub
        {...callbacks}
        {...animalPresentationProps}
        dataNotice={null}
        rankedValues={rankedValues}
      />,
    )

    expect(screen.getByText("Not ranked yet.")).toBeOnTheScreen()
    expect(
      screen.getByText(
        "Browse the included values, then battle when you are ready.",
      ),
    ).toBeOnTheScreen()
    expect(screen.queryByText("Top Five")).not.toBeOnTheScreen()
    expect(screen.queryByText("#1")).not.toBeOnTheScreen()

    const visibleValueButtons = screen.getAllByRole("button", {
      name: /^Open .* in All Values$/,
    })

    expect(visibleValueButtons[0]).toHaveAccessibleName(
      "Open Acceptance in All Values",
    )
    expect(visibleValueButtons[1]).toHaveAccessibleName(
      "Open Accuracy in All Values",
    )
    expect(visibleValueButtons[2]).toHaveAccessibleName(
      "Open Achievement in All Values",
    )

    await user.press(screen.getByRole("button", { name: "Browse All Values" }))
    await user.press(screen.getByRole("button", { name: "Add Custom Value" }))
    await user.press(screen.getByRole("button", { name: "Menu" }))
    await user.press(visibleValueButtons[0])

    expect(callbacks.onBrowseAllValues).toHaveBeenCalledTimes(1)
    expect(callbacks.onAddCustomValue).toHaveBeenCalledTimes(1)
    expect(callbacks.onOpenMenu).toHaveBeenCalledTimes(1)
    expect(callbacks.onOpenValue).toHaveBeenCalledWith(
      rankedValues.find(
        ({ definition }) => getValueDisplayName(definition) === "Acceptance",
      )?.definition.id,
    )
  })

  it("presents committed evidence as Top Five followed by all other values", async () => {
    const callbacks = createHubCallbacks()
    const user = userEvent.setup()
    const rankedValues = createRankedValuesWithEvidence()
    const firstRankedValue = rankedValues[0]
    const firstRankedValueName = getValueDisplayName(
      firstRankedValue.definition,
    )
    await render(
      <NativeHub
        {...callbacks}
        {...animalPresentationProps}
        dataNotice="Your imported data is ready."
        rankedValues={rankedValues}
      />,
    )

    expect(
      screen.getByText("Your ranking is based on your committed battles."),
    ).toBeOnTheScreen()
    expect(screen.getByText("Top Five")).toBeOnTheScreen()
    expect(screen.getByText("All Other Values")).toBeOnTheScreen()
    expect(screen.getByText("Your imported data is ready.")).toBeOnTheScreen()
    expect(screen.getByText("#1")).toBeOnTheScreen()

    await user.press(
      screen.getByRole("button", {
        name: `Rank 1. Open ${firstRankedValueName} in All Values`,
      }),
    )
    await user.press(screen.getByRole("button", { name: "Battle" }))

    expect(callbacks.onOpenValue).toHaveBeenCalledWith(
      firstRankedValue.definition.id,
    )
    expect(callbacks.onStartBattle).toHaveBeenCalledTimes(1)
  })
})

import { getValueDisplayDefinition } from "@game/data/src/Value"
import { getValueChoiceAccessibilityLabel } from "@game/machines/src/BattleAccessibilityPresentation"
import { createInitialBattleCycle } from "@game/machines/src/BattleCycle"
import { projectBattlePair } from "@game/machines/src/BattleScheduler"
import type { PresentedBattle } from "@game/machines/src/CombatMachine"
import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import NativeCrucible from "@/components/NativeCrucible"

const VALUE_CHOICE_ACCESSIBLE_NAME_PATTERN =
  /^Choose .+\. Level \d+\. Choice [12]\.$/

const battleCycle = createInitialBattleCycle("native-crucible-evidence")
const battle = Object.freeze({
  pair: projectBattlePair(battleCycle.activeDeck, battleCycle.scheduler),
  scheduler: battleCycle.scheduler,
})
const [firstValueId, secondValueId] = battle.pair
const firstValue = battleCycle.activeDeck.values.find(
  ({ id }) => id === firstValueId,
)
const secondValue = battleCycle.activeDeck.values.find(
  ({ id }) => id === secondValueId,
)

if (!firstValue || !secondValue)
  throw new Error("Projected native test battle is missing Active Deck data")

function createCrucibleProps(isPersistencePending: boolean) {
  return {
    activeDeck: battleCycle.activeDeck,
    achievement: null,
    battle,
    progressById: battleCycle.progressById,
    canUndo: true,
    canRedo: true,
    controlHintPreference: "auto" as const,
    isAchievementAcknowledgementPending: false,
    isMenuOpen: false,
    isPersistencePending,
    shouldReduceMotion: false,
    onAchievementPresented: jest.fn(),
    onExit: jest.fn(),
    onOpenMenu: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    onWinnerSelected: jest.fn(),
  }
}

describe("NativeCrucible", () => {
  it("renders complete value choices and commits exactly one presented winner", async () => {
    const props = createCrucibleProps(false)
    const user = userEvent.setup()
    await render(<NativeCrucible {...props} />)

    const firstChoice = await screen.findByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "first",
        value: firstValue,
        level: 1,
      }),
    })
    const secondChoice = screen.getByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "second",
        value: secondValue,
        level: 1,
      }),
    })

    expect(firstChoice).toBeEnabled()
    expect(secondChoice).toBeEnabled()
    expect(
      screen.getByText(`“${getValueDisplayDefinition(firstValue)}”`),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(`“${getValueDisplayDefinition(secondValue)}”`),
    ).toBeOnTheScreen()
    expect(screen.getAllByText("LVL 1")).toHaveLength(2)
    expect(screen.queryByText("Tap")).toBeNull()

    await user.press(firstChoice)
    await user.press(secondChoice)

    expect(props.onWinnerSelected).toHaveBeenCalledTimes(1)
    expect(props.onWinnerSelected).toHaveBeenCalledWith(
      firstValueId,
      battleCycle.scheduler,
    )
  })

  it("shows touch hints only when Always is selected without changing card semantics", async () => {
    const props = createCrucibleProps(false)
    const { rerender } = await render(
      <NativeCrucible {...props} controlHintPreference="always" />,
    )
    const choices = await screen.findAllByRole("button", {
      name: VALUE_CHOICE_ACCESSIBLE_NAME_PATTERN,
    })
    const tapHints = screen.getAllByText("Tap", {
      includeHiddenElements: true,
    })

    expect(tapHints).toHaveLength(2)
    for (const tapHint of tapHints) {
      expect(tapHint).toHaveProp("aria-hidden", true)
      expect(tapHint.props.className).toContain("w-12")
      expect(tapHint.props.className).toContain("xl:w-24")
      expect(tapHint.props.className).not.toContain("opacity-0")
    }

    await rerender(<NativeCrucible {...props} controlHintPreference="off" />)

    expect(
      screen.queryByText("Tap", { includeHiddenElements: true }),
    ).toBeNull()
    expect(
      screen.getAllByRole("button", {
        name: VALUE_CHOICE_ACCESSIBLE_NAME_PATTERN,
      }),
    ).toHaveLength(2)
  })

  it("blocks value choice and battle actions while persistence is pending", async () => {
    const props = createCrucibleProps(true)
    const user = userEvent.setup()
    await render(<NativeCrucible {...props} />)

    const firstChoice = await screen.findByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "first",
        value: firstValue,
        level: 1,
      }),
    })
    const secondChoice = screen.getByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "second",
        value: secondValue,
        level: 1,
      }),
    })

    expect(screen.getByLabelText("Value battle")).toBeBusy()
    expect(firstChoice).toBeDisabled()
    expect(secondChoice).toBeDisabled()
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Redo" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Stop" })).toBeDisabled()

    await user.press(firstChoice)
    await user.press(screen.getByRole("button", { name: "Stop" }))

    expect(props.onWinnerSelected).not.toHaveBeenCalled()
    expect(props.onExit).not.toHaveBeenCalled()
  })

  it("preserves the exact pair and blocks every battle action while Menu is open", async () => {
    const props = createCrucibleProps(false)
    const user = userEvent.setup()
    const { rerender } = await render(<NativeCrucible {...props} />)
    expect(
      await screen.findByRole("button", {
        name: getValueChoiceAccessibilityLabel({
          position: "first",
          value: firstValue,
          level: 1,
        }),
      }),
    ).toBeEnabled()

    await rerender(<NativeCrucible {...props} isMenuOpen />)

    const firstChoice = screen.getByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "first",
        value: firstValue,
        level: 1,
      }),
    })
    const secondChoice = screen.getByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "second",
        value: secondValue,
        level: 1,
      }),
    })
    expect(firstChoice).toBeDisabled()
    expect(secondChoice).toBeDisabled()
    expect(
      screen.getByText(`“${getValueDisplayDefinition(firstValue)}”`),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(`“${getValueDisplayDefinition(secondValue)}”`),
    ).toBeOnTheScreen()

    for (const actionName of ["Undo", "Redo", "Stop", "Menu"])
      expect(screen.getByRole("button", { name: actionName })).toBeDisabled()

    await user.press(firstChoice)
    await user.press(secondChoice)
    await user.press(screen.getByRole("button", { name: "Undo" }))
    await user.press(screen.getByRole("button", { name: "Redo" }))
    await user.press(screen.getByRole("button", { name: "Stop" }))
    await user.press(screen.getByRole("button", { name: "Menu" }))

    expect(props.onWinnerSelected).not.toHaveBeenCalled()
    expect(props.onUndo).not.toHaveBeenCalled()
    expect(props.onRedo).not.toHaveBeenCalled()
    expect(props.onExit).not.toHaveBeenCalled()
    expect(props.onOpenMenu).not.toHaveBeenCalled()
  })

  it("presents an explicit scheduler-loading state before a pair is available", async () => {
    const props = createCrucibleProps(false)
    const pendingBattle = Object.freeze({
      pair: null,
      scheduler: battle.scheduler,
    }) satisfies PresentedBattle

    await render(<NativeCrucible {...props} battle={pendingBattle} />)

    expect(screen.getByText("Forging Matrix…")).toHaveProp(
      "accessibilityLiveRegion",
      "polite",
    )
    expect(screen.queryByLabelText("Value battle")).toBeNull()
  })

  it("rejects a projected pair whose authoritative progress is missing", async () => {
    const props = createCrucibleProps(false)
    const incompleteProgressById = new Map(battleCycle.progressById)
    incompleteProgressById.delete(firstValueId)

    await expect(
      render(
        <NativeCrucible {...props} progressById={incompleteProgressById} />,
      ),
    ).rejects.toThrow("Projected battle is missing Active Deck data")
  })
})

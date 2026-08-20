import {
  getValueDisplayDefinition,
  getValueDisplayName,
} from "@game/data/src/Value"
import { createInitialBattleCycle } from "@game/machines/src/BattleCycle"
import { projectBattlePair } from "@game/machines/src/BattleScheduler"
import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import NativeCrucible from "@/components/NativeCrucible"

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
    isAchievementAcknowledgementPending: false,
    isPersistencePending,
    onAchievementPresented: jest.fn(),
    onExit: jest.fn(),
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

    const firstValueName = getValueDisplayName(firstValue)
    const secondValueName = getValueDisplayName(secondValue)
    const firstChoice = await screen.findByRole("button", {
      name: `Choose ${firstValueName}`,
    })
    const secondChoice = screen.getByRole("button", {
      name: `Choose ${secondValueName}`,
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

    await user.press(firstChoice)
    await user.press(secondChoice)

    expect(props.onWinnerSelected).toHaveBeenCalledTimes(1)
    expect(props.onWinnerSelected).toHaveBeenCalledWith(
      firstValueId,
      battleCycle.scheduler,
    )
  })

  it("blocks value choice and battle actions while persistence is pending", async () => {
    const props = createCrucibleProps(true)
    const user = userEvent.setup()
    await render(<NativeCrucible {...props} />)

    const firstChoice = await screen.findByRole("button", {
      name: `Choose ${getValueDisplayName(firstValue)}`,
    })
    const secondChoice = screen.getByRole("button", {
      name: `Choose ${getValueDisplayName(secondValue)}`,
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
})

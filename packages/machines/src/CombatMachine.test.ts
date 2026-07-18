import { describe, expect, it, vi } from "vitest"
import { createActor } from "xstate"
import {
  createBattleCycleCandidate,
  createInitialBattleCycle,
} from "./BattleCycle"
import { combatMachine, type PresentedBattle } from "./CombatMachine"
import { projectScheduledPair } from "./PairScheduler"

function projectBattle(
  battleCycle: ReturnType<typeof createInitialBattleCycle>,
): PresentedBattle {
  return Object.freeze({
    pair: projectScheduledPair(battleCycle.activeDeck, battleCycle.scheduler)
      .pair,
    scheduler: battleCycle.scheduler,
  })
}

describe("Combat Machine", () => {
  it("accepts one semantic winner while rejecting rapid duplicate input", () => {
    const onWinnerSelected = vi.fn()
    const battleCycle = createInitialBattleCycle("combat-selection-seed")
    const battle = projectBattle(battleCycle)
    const [winnerId] = battle.pair
    const actor = createActor(combatMachine, {
      input: { onWinnerSelected },
    })
    actor.start()
    actor.send({ type: "BATTLE.PROJECTED", battle })

    expect(actor.getSnapshot().matches("AwaitingInput")).toBe(true)
    actor.send({ type: "VALUE.FOCUS_REQUESTED", valueId: winnerId })
    expect(actor.getSnapshot().context.focusedId).toBe(winnerId)

    actor.send({ type: "VALUE.WINNER_SELECTED", valueId: winnerId })
    actor.send({ type: "VALUE.WINNER_SELECTED", valueId: winnerId })

    expect(actor.getSnapshot().matches("AnimatingResult")).toBe(true)
    expect(actor.getSnapshot().context.winnerId).toBe(winnerId)
    expect(onWinnerSelected).toHaveBeenCalledTimes(1)
    expect(onWinnerSelected).toHaveBeenCalledWith(
      winnerId,
      battleCycle.scheduler,
    )
  })

  it("holds the next projection until result animation completes", () => {
    const onWinnerSelected = vi.fn()
    const battleCycle = createInitialBattleCycle("combat-animation-seed")
    const currentBattle = projectBattle(battleCycle)
    const [winnerId] = currentBattle.pair
    const nextBattleCycle = createBattleCycleCandidate({
      battleCycle,
      winnerId,
      expectedScheduler: battleCycle.scheduler,
    })
    const nextBattle = projectBattle(nextBattleCycle)
    const actor = createActor(combatMachine, {
      input: { onWinnerSelected },
    })
    actor.start()
    actor.send({ type: "BATTLE.PROJECTED", battle: currentBattle })
    actor.send({ type: "VALUE.WINNER_SELECTED", valueId: winnerId })
    actor.send({ type: "BATTLE.PROJECTED", battle: nextBattle })

    expect(actor.getSnapshot().context.currentBattle).toBe(currentBattle)
    expect(actor.getSnapshot().context.pendingBattle).toBe(nextBattle)

    actor.send({ type: "ANIMATION.RESULT_FINISHED" })

    expect(actor.getSnapshot().matches("AwaitingInput")).toBe(true)
    expect(actor.getSnapshot().context.currentBattle).toBe(nextBattle)
    expect(actor.getSnapshot().context.pendingBattle).toBeNull()
    expect(actor.getSnapshot().context.winnerId).toBeNull()
  })

  it("waits for a projection when animation finishes before Root advances", () => {
    const battleCycle = createInitialBattleCycle("delayed-projection-seed")
    const battle = projectBattle(battleCycle)
    const actor = createActor(combatMachine, {
      input: { onWinnerSelected: vi.fn() },
    })
    actor.start()
    actor.send({ type: "BATTLE.PROJECTED", battle })
    actor.send({
      type: "VALUE.WINNER_SELECTED",
      valueId: battle.pair[0],
    })
    actor.send({ type: "ANIMATION.RESULT_FINISHED" })

    expect(actor.getSnapshot().matches("Preparing")).toBe(true)
    expect(actor.getSnapshot().context.currentBattle).toBeNull()
  })
})

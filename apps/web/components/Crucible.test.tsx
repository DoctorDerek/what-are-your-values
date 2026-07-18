import { getValueDisplayName } from "@game/data/src/Value"
import { createInitialBattleCycle } from "@game/machines/src/BattleCycle"
import type { PresentedBattle } from "@game/machines/src/CombatMachine"
import { projectScheduledPair } from "@game/machines/src/PairScheduler"
import { act, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Crucible from "./Crucible"

function createBattleProps(seed: string) {
  const battleCycle = createInitialBattleCycle(seed)
  const battle = Object.freeze({
    pair: projectScheduledPair(battleCycle.activeDeck, battleCycle.scheduler)
      .pair,
    scheduler: battleCycle.scheduler,
  }) satisfies PresentedBattle

  return { battleCycle, battle }
}

describe("Crucible Component Integration", () => {
  it("renders semantic canonical values and commits a keyboard selection once", async () => {
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps("keyboard-battle-seed")
    const [winnerId, loserId] = battle.pair
    const winner = battleCycle.activeDeck.values.find(
      ({ id }) => id === winnerId,
    )
    const loser = battleCycle.activeDeck.values.find(({ id }) => id === loserId)
    if (!winner || !loser) {
      throw new Error("Projected definitions are missing")
    }

    render(
      <Crucible
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={vi.fn()}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    expect(await screen.findByText(getValueDisplayName(winner))).toBeVisible()
    expect(screen.getByText(getValueDisplayName(loser))).toBeVisible()

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }))
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }))
    })

    expect(onWinnerSelected).toHaveBeenCalledTimes(1)
    expect(onWinnerSelected).toHaveBeenCalledWith(
      winnerId,
      battleCycle.scheduler,
    )
  })

  it("focuses a card before committing its second click", async () => {
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps("pointer-battle-seed")
    const [winnerId] = battle.pair

    render(
      <Crucible
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={vi.fn()}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    const cardAIndicator = await screen.findByText("[1 / A]")
    const cardA = cardAIndicator.closest("div")
    if (!cardA) {
      throw new Error("Card A was not rendered")
    }

    act(() => cardA.click())
    expect(cardA.className).toContain("ring-8")
    expect(onWinnerSelected).not.toHaveBeenCalled()

    act(() => cardA.click())
    expect(onWinnerSelected).toHaveBeenCalledWith(winnerId, battle.scheduler)
  })

  it("supports arrow focus, keyboard confirmation, and Escape", async () => {
    const onExit = vi.fn()
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps("navigation-battle-seed")
    const [, winnerId] = battle.pair

    render(
      <Crucible
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={onExit}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    const cardBIndicator = await screen.findByText("[2 / D]")
    const cardB = cardBIndicator.closest("div")
    if (!cardB) {
      throw new Error("Card B was not rendered")
    }

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
    })
    expect(cardB.className).toContain("ring-8")

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    })

    expect(onWinnerSelected).toHaveBeenCalledWith(winnerId, battle.scheduler)
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})

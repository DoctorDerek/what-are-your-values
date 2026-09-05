import { createSeethingSwarmTypographyOnlyRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import { createInitialBattleCycle } from "@game/machines/src/BattleCycle"
import type { PresentedBattle } from "@game/machines/src/CombatMachine"
import { projectScheduledPair } from "@game/machines/src/PairScheduler"
import { fireEvent, render, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import SeethingSwarmBattleStage from "./SeethingSwarmBattleStage"
import { createSeethingSwarmBattleStageTestCatalog } from "./SeethingSwarmBattleStage.test-fixture"

function createPresentedBattle(seed: string) {
  const battleCycle = createInitialBattleCycle(seed)
  return Object.freeze({
    pair: projectScheduledPair(battleCycle.activeDeck, battleCycle.scheduler)
      .pair,
    scheduler: battleCycle.scheduler,
  }) satisfies PresentedBattle
}

function getBattleStage(container: HTMLElement) {
  const stage = container.querySelector<HTMLElement>(
    "[data-battle-stage-state]",
  )
  if (!stage) throw new Error("Battle Stage is missing")
  return stage
}

function getCombatant(container: HTMLElement, side: "first" | "second") {
  const combatant = container.querySelector<HTMLElement>(
    `[data-combatant-side="${side}"]`,
  )
  if (!combatant) throw new Error(`${side} Battle Stage combatant is missing`)
  return combatant
}

describe("SeethingSwarmBattleStage", () => {
  it("keeps two licensed combatants facing one another in resting loops", () => {
    const battle = createPresentedBattle("licensed-resting-stage")
    const runtimeClipCatalog = createSeethingSwarmBattleStageTestCatalog(battle)
    const { container } = render(
      <SeethingSwarmBattleStage
        battle={battle}
        isNextBattleReady={false}
        runtimeClipCatalog={runtimeClipCatalog}
        shouldReduceMotion={false}
        winnerId={null}
        onResultAnimationComplete={vi.fn()}
      />,
    )

    const stage = getBattleStage(container)
    const firstCombatant = getCombatant(container, "first")
    const secondCombatant = getCombatant(container, "second")
    expect(stage).toHaveAttribute("aria-hidden", "true")
    expect(stage).toHaveAttribute("data-battle-stage-mode", "licensed")
    expect(stage).toHaveAttribute("data-battle-stage-state", "awaiting-input")
    expect(firstCombatant).toHaveAttribute("data-value-id", battle.pair[0])
    expect(secondCombatant).toHaveAttribute("data-value-id", battle.pair[1])
    expect(firstCombatant).toHaveAttribute("data-battle-role", "rest")
    expect(secondCombatant).toHaveAttribute("data-battle-role", "rest")
    expect(
      firstCombatant.querySelector('[data-playback-mode="loop"]'),
    ).toHaveAttribute("data-facing", "right")
    expect(
      secondCombatant.querySelector('[data-playback-mode="loop"]'),
    ).toHaveAttribute("data-facing", "left")
  })

  it("waits for both result clips and the pending durable pair exactly once", () => {
    const battle = createPresentedBattle("licensed-result-stage")
    const runtimeClipCatalog = createSeethingSwarmBattleStageTestCatalog(battle)
    const onResultAnimationComplete = vi.fn()
    const { container, rerender } = render(
      <SeethingSwarmBattleStage
        battle={battle}
        isNextBattleReady={false}
        runtimeClipCatalog={runtimeClipCatalog}
        shouldReduceMotion={false}
        winnerId={null}
        onResultAnimationComplete={onResultAnimationComplete}
      />,
    )

    rerender(
      <SeethingSwarmBattleStage
        battle={battle}
        isNextBattleReady={false}
        runtimeClipCatalog={runtimeClipCatalog}
        shouldReduceMotion={false}
        winnerId={battle.pair[0]}
        onResultAnimationComplete={onResultAnimationComplete}
      />,
    )
    expect(getBattleStage(container)).toHaveAttribute(
      "data-battle-stage-state",
      "resolving",
    )
    expect(getCombatant(container, "first")).toHaveAttribute(
      "data-battle-role",
      "attack",
    )
    expect(getCombatant(container, "second")).toHaveAttribute(
      "data-battle-role",
      "reaction",
    )

    const resultImages = container.querySelectorAll(
      '[data-playback-mode="one-shot"] img',
    )
    expect(resultImages).toHaveLength(2)
    fireEvent.animationEnd(resultImages[0]!)
    fireEvent.animationEnd(resultImages[1]!)
    expect(onResultAnimationComplete).not.toHaveBeenCalled()

    rerender(
      <SeethingSwarmBattleStage
        battle={battle}
        isNextBattleReady
        runtimeClipCatalog={runtimeClipCatalog}
        shouldReduceMotion={false}
        winnerId={battle.pair[0]}
        onResultAnimationComplete={onResultAnimationComplete}
      />,
    )
    expect(onResultAnimationComplete).toHaveBeenCalledTimes(1)
    fireEvent.animationEnd(resultImages[0]!)
    fireEvent.animationEnd(resultImages[1]!)
    expect(onResultAnimationComplete).toHaveBeenCalledTimes(1)
  })

  it("keeps equivalent placeholder combatants in public-clone mode", () => {
    const battle = createPresentedBattle("placeholder-result-stage")
    const runtimeClipCatalog =
      createSeethingSwarmTypographyOnlyRuntimeClipCatalog()
    const onResultAnimationComplete = vi.fn()
    const { container, rerender } = render(
      <SeethingSwarmBattleStage
        battle={battle}
        isNextBattleReady={false}
        runtimeClipCatalog={runtimeClipCatalog}
        shouldReduceMotion={false}
        winnerId={null}
        onResultAnimationComplete={onResultAnimationComplete}
      />,
    )

    expect(getBattleStage(container)).toHaveAttribute(
      "data-battle-stage-mode",
      "placeholder",
    )
    expect(
      container.querySelectorAll('[data-placeholder-playback="loop"]'),
    ).toHaveLength(2)

    rerender(
      <SeethingSwarmBattleStage
        battle={battle}
        isNextBattleReady
        runtimeClipCatalog={runtimeClipCatalog}
        shouldReduceMotion={false}
        winnerId={battle.pair[1]}
        onResultAnimationComplete={onResultAnimationComplete}
      />,
    )
    const resultPlaceholders = container.querySelectorAll(
      '[data-placeholder-playback="one-shot"]',
    )
    expect(resultPlaceholders).toHaveLength(2)
    fireEvent.animationEnd(resultPlaceholders[0]!)
    expect(onResultAnimationComplete).not.toHaveBeenCalled()
    fireEvent.animationEnd(resultPlaceholders[1]!)
    expect(onResultAnimationComplete).toHaveBeenCalledTimes(1)
  })

  it("uses stable frames and still waits for the pending pair under Reduced Motion", async () => {
    const battle = createPresentedBattle("reduced-motion-stage")
    const runtimeClipCatalog = createSeethingSwarmBattleStageTestCatalog(battle)
    const onResultAnimationComplete = vi.fn()
    const { container, rerender } = render(
      <SeethingSwarmBattleStage
        battle={battle}
        isNextBattleReady={false}
        runtimeClipCatalog={runtimeClipCatalog}
        shouldReduceMotion
        winnerId={battle.pair[0]}
        onResultAnimationComplete={onResultAnimationComplete}
      />,
    )

    expect(
      container.querySelectorAll('[data-playback-mode="static"]'),
    ).toHaveLength(2)
    expect(onResultAnimationComplete).not.toHaveBeenCalled()
    rerender(
      <SeethingSwarmBattleStage
        battle={battle}
        isNextBattleReady
        runtimeClipCatalog={runtimeClipCatalog}
        shouldReduceMotion
        winnerId={battle.pair[0]}
        onResultAnimationComplete={onResultAnimationComplete}
      />,
    )
    await waitFor(() =>
      expect(onResultAnimationComplete).toHaveBeenCalledTimes(1),
    )
  })
})

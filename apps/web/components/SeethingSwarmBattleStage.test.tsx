import { createSeethingSwarmTypographyOnlyRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import { createInitialBattleCycle } from "@game/machines/src/BattleCycle"
import type { PresentedBattle } from "@game/machines/src/CombatMachine"
import { projectScheduledPair } from "@game/machines/src/PairScheduler"
import {
  createSeethingSwarmBattleChoreography,
  type SeethingSwarmBattleCombatantSide,
} from "@game/machines/src/SeethingSwarmBattleChoreography"
import { act, fireEvent, render, waitFor } from "@testing-library/react"
import { StrictMode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import SeethingSwarmBattleStage from "@/components/SeethingSwarmBattleStage"
import { createSeethingSwarmBattleStageTestCatalog } from "@/components/SeethingSwarmBattleStage.test-fixture"

function createPresentedBattle(seed: string) {
  const battleCycle = createInitialBattleCycle(seed)
  return Object.freeze({
    pair: projectScheduledPair(battleCycle.activeDeck, battleCycle.scheduler)
      .pair,
    scheduler: battleCycle.scheduler,
  }) satisfies PresentedBattle
}

function createStageProps(seed: string) {
  const battle = createPresentedBattle(seed)
  return {
    battle,
    isNextBattleReady: false,
    runtimeClipCatalog: createSeethingSwarmBattleStageTestCatalog(battle),
    shouldReduceMotion: false,
    winnerId: null,
    onResultAnimationComplete: vi.fn(),
  }
}

function getCombatant(
  container: HTMLElement,
  side: SeethingSwarmBattleCombatantSide,
) {
  const combatant = container.querySelector<HTMLElement>(
    `[data-combatant-side="${side}"]`,
  )
  if (!combatant) throw new Error(`${side} Battle Stage combatant is missing`)
  return combatant
}

function getSprite(
  container: HTMLElement,
  side: SeethingSwarmBattleCombatantSide,
) {
  const image = getCombatant(container, side).querySelector("img")
  if (!image) throw new Error(`${side} animal image is missing`)
  return image
}

async function finishClip(
  container: HTMLElement,
  side: SeethingSwarmBattleCombatantSide,
) {
  const image = getSprite(container, side)
  fireEvent.load(image)
  await waitFor(() =>
    expect(image.parentElement).toHaveAttribute("data-playback-ready", "true"),
  )
  fireEvent.animationEnd(image)
}

function getRole(
  container: HTMLElement,
  side: SeethingSwarmBattleCombatantSide,
) {
  return getCombatant(container, side).querySelector("[data-battle-role]")
}

afterEach(() => vi.restoreAllMocks())

describe("SeethingSwarmBattleStage", () => {
  it("plays entry then anticipation before settling both animals into rest", async () => {
    const props = createStageProps("licensed-introduction")
    const choreography = createSeethingSwarmBattleChoreography({
      battle: props.battle,
      catalog: props.runtimeClipCatalog,
    })
    if (choreography.mode !== "licensed")
      throw new Error("Licensed test choreography required")
    const { container, rerender } = render(
      <SeethingSwarmBattleStage {...props} />,
    )
    expect(
      container.querySelector("[data-battle-stage-state]"),
    ).toHaveAttribute("aria-hidden", "true")
    expect(container.querySelectorAll("img")).toHaveLength(2)

    for (const combatant of choreography.combatants) {
      expect(getCombatant(container, combatant.side)).toHaveAttribute(
        "data-value-id",
        combatant.valueId,
      )
      expect(getSprite(container, combatant.side).src).toBe(
        new URL(combatant.clips.entry.clip.asset.src, window.location.href)
          .href,
      )
      expect(getRole(container, combatant.side)).toHaveAttribute(
        "data-battle-role",
        "entry",
      )
      await finishClip(container, combatant.side)
      expect(getRole(container, combatant.side)).toHaveAttribute(
        "data-battle-role",
        "anticipation",
      )
      expect(getSprite(container, combatant.side).src).toBe(
        new URL(
          combatant.clips.anticipation.clip.asset.src,
          window.location.href,
        ).href,
      )
      rerender(<SeethingSwarmBattleStage {...props} />)
      expect(getRole(container, combatant.side)).toHaveAttribute(
        "data-battle-role",
        "anticipation",
      )
      await finishClip(container, combatant.side)
      expect(getRole(container, combatant.side)).toHaveAttribute(
        "data-battle-role",
        "rest",
      )
      expect(getSprite(container, combatant.side).src).toBe(
        new URL(combatant.clips.rest.clip.asset.src, window.location.href).href,
      )
      expect(
        getSprite(container, combatant.side).parentElement,
      ).toHaveAttribute("data-playback-mode", "loop")
      expect(
        getSprite(container, combatant.side).parentElement,
      ).toHaveAttribute(
        "data-facing",
        combatant.side === "first" ? "right" : "left",
      )
    }
    expect(props.onResultAnimationComplete).not.toHaveBeenCalled()
  })

  it.each([0, 1] as const)(
    "interrupts introductions for winner %i and waits for flourish, reaction and the durable pair",
    async (winnerIndex) => {
      const props = createStageProps(`licensed-result-${winnerIndex}`)
      const winnerSide = winnerIndex === 0 ? "first" : "second"
      const loserSide = winnerIndex === 0 ? "second" : "first"
      const { container, rerender } = render(
        <SeethingSwarmBattleStage {...props} />,
      )
      const oldIntroduction = getSprite(container, winnerSide)
      const resultProps = { ...props, winnerId: props.battle.pair[winnerIndex] }
      rerender(<SeethingSwarmBattleStage {...resultProps} />)
      fireEvent.animationEnd(oldIntroduction)
      expect(getRole(container, winnerSide)).toHaveAttribute(
        "data-battle-role",
        "attack",
      )
      expect(getRole(container, loserSide)).toHaveAttribute(
        "data-battle-role",
        "reaction",
      )
      await finishClip(container, winnerSide)
      expect(getRole(container, winnerSide)).toHaveAttribute(
        "data-battle-role",
        "flourish",
      )
      await finishClip(container, loserSide)
      expect(getSprite(container, loserSide).parentElement).toHaveAttribute(
        "data-playback-mode",
        "hold-final-frame",
      )
      expect(props.onResultAnimationComplete).not.toHaveBeenCalled()
      await finishClip(container, winnerSide)
      expect(
        container.querySelectorAll('[data-playback-mode="hold-final-frame"]'),
      ).toHaveLength(2)
      expect(props.onResultAnimationComplete).not.toHaveBeenCalled()

      rerender(<SeethingSwarmBattleStage {...resultProps} isNextBattleReady />)
      expect(props.onResultAnimationComplete).toHaveBeenCalledTimes(1)
      fireEvent.animationEnd(getSprite(container, winnerSide))
      fireEvent.animationEnd(getSprite(container, loserSide))
      rerender(<SeethingSwarmBattleStage {...resultProps} isNextBattleReady />)
      expect(props.onResultAnimationComplete).toHaveBeenCalledTimes(1)
    },
  )

  it("does not advance a durable next pair until the winner's flourish ends", async () => {
    const props = createStageProps("early-durable-pair")
    const { container } = render(
      <SeethingSwarmBattleStage
        {...props}
        winnerId={props.battle.pair[0]}
        isNextBattleReady
      />,
    )
    await finishClip(container, "second")
    await finishClip(container, "first")
    expect(props.onResultAnimationComplete).not.toHaveBeenCalled()
    await finishClip(container, "first")
    expect(props.onResultAnimationComplete).toHaveBeenCalledTimes(1)
  })

  it("preserves one integer scale when a selected move has smaller visible bounds", async () => {
    const props = createStageProps("stable-compound-scale")
    const runtimeClipCatalog = {
      ...props.runtimeClipCatalog,
      animals: props.runtimeClipCatalog.animals.map((animal) => ({
        ...animal,
        characterClips: animal.characterClips.map((clip) =>
          clip.animationId === "attack"
            ? {
                ...clip,
                visibleBounds: { left: 0, top: 0, width: 16, height: 16 },
              }
            : clip,
        ),
      })),
    }
    const { container, rerender } = render(
      <SeethingSwarmBattleStage
        {...props}
        runtimeClipCatalog={runtimeClipCatalog}
      />,
    )
    const initialWidth = getSprite(container, "first").width
    rerender(
      <SeethingSwarmBattleStage
        {...props}
        runtimeClipCatalog={runtimeClipCatalog}
        winnerId={props.battle.pair[0]}
      />,
    )
    expect(getSprite(container, "first").width).toBe(initialWidth)
    await finishClip(container, "first")
    expect(getSprite(container, "first").width).toBe(initialWidth)
  })

  it("does not reuse completed sides when a different battle replaces the result", async () => {
    const props = createStageProps("replaced-result")
    const nextBattle = createPresentedBattle("new-result")
    const catalog = createSeethingSwarmBattleStageTestCatalog(
      props.battle,
      nextBattle,
    )
    const { container, rerender } = render(
      <SeethingSwarmBattleStage
        {...props}
        runtimeClipCatalog={catalog}
        winnerId={props.battle.pair[0]}
      />,
    )
    await finishClip(container, "second")
    const oldWinner = getSprite(container, "first")
    rerender(
      <SeethingSwarmBattleStage
        {...props}
        runtimeClipCatalog={catalog}
        battle={nextBattle}
        winnerId={nextBattle.pair[0]}
        isNextBattleReady
      />,
    )
    fireEvent.animationEnd(oldWinner)
    await finishClip(container, "first")
    await finishClip(container, "first")
    expect(props.onResultAnimationComplete).not.toHaveBeenCalled()
    await finishClip(container, "second")
    expect(props.onResultAnimationComplete).toHaveBeenCalledTimes(1)
  })

  it("keeps failed images playable through the existing placeholder result", async () => {
    const props = createStageProps("failed-result-image")
    const { container } = render(
      <SeethingSwarmBattleStage
        {...props}
        winnerId={props.battle.pair[0]}
        isNextBattleReady
      />,
    )
    fireEvent.error(getSprite(container, "first"))
    expect(getCombatant(container, "first").querySelector("img")).toBeNull()
    const placeholder = getCombatant(container, "first").querySelector(
      "[data-placeholder-playback]",
    )
    if (!placeholder) throw new Error("Failed image placeholder is missing")
    expect(placeholder).toHaveAttribute("data-battle-role", "attack")
    fireEvent.animationEnd(placeholder)
    expect(props.onResultAnimationComplete).not.toHaveBeenCalled()
    await finishClip(container, "second")
    expect(props.onResultAnimationComplete).toHaveBeenCalledTimes(1)
  })

  it("keeps equivalent placeholder combatants in public-clone mode", () => {
    const props = {
      ...createStageProps("public-clone"),
      runtimeClipCatalog: createSeethingSwarmTypographyOnlyRuntimeClipCatalog(),
    }
    const { container, rerender } = render(
      <SeethingSwarmBattleStage {...props} />,
    )
    expect(
      container.querySelectorAll('[data-placeholder-playback="loop"]'),
    ).toHaveLength(2)
    rerender(
      <SeethingSwarmBattleStage
        {...props}
        winnerId={props.battle.pair[1]}
        isNextBattleReady
      />,
    )
    const placeholders = container.querySelectorAll(
      '[data-placeholder-playback="one-shot"]',
    )
    expect(placeholders).toHaveLength(2)
    fireEvent.animationEnd(placeholders[0]!)
    expect(props.onResultAnimationComplete).not.toHaveBeenCalled()
    fireEvent.animationEnd(placeholders[1]!)
    fireEvent.animationEnd(placeholders[1]!)
    expect(props.onResultAnimationComplete).toHaveBeenCalledTimes(1)
  })

  it.each(["reduced", "menu", "background"] as const)(
    "settles %s interruptions only when the next pair is durable",
    async (interruption) => {
      const visibility = vi
        .spyOn(document, "visibilityState", "get")
        .mockReturnValue("visible")
      const props = createStageProps(`interruption-${interruption}`)
      const resultProps = { ...props, winnerId: props.battle.pair[0] }
      const { container, rerender, unmount } = render(
        <StrictMode>
          <SeethingSwarmBattleStage {...resultProps} />
        </StrictMode>,
      )
      const oldImage = getSprite(container, "first")
      const interruptedProps = {
        ...resultProps,
        shouldReduceMotion: interruption === "reduced",
        isPaused: interruption === "menu",
      }
      if (interruption === "background") {
        visibility.mockReturnValue("hidden")
        act(() => document.dispatchEvent(new Event("visibilitychange")))
      }
      rerender(
        <StrictMode>
          <SeethingSwarmBattleStage {...interruptedProps} />
        </StrictMode>,
      )
      expect(
        container.querySelectorAll('[data-playback-mode="static"]'),
      ).toHaveLength(2)
      fireEvent.animationEnd(oldImage)
      expect(props.onResultAnimationComplete).not.toHaveBeenCalled()
      rerender(
        <StrictMode>
          <SeethingSwarmBattleStage {...interruptedProps} isNextBattleReady />
        </StrictMode>,
      )
      await waitFor(() =>
        expect(props.onResultAnimationComplete).toHaveBeenCalledTimes(1),
      )
      unmount()
      act(() => document.dispatchEvent(new Event("visibilitychange")))
      expect(props.onResultAnimationComplete).toHaveBeenCalledTimes(1)
    },
  )

  it("shows representative resting frames behind a reading panel without resolving a choice", () => {
    const props = createStageProps("paused-introduction")
    const { container } = render(
      <SeethingSwarmBattleStage {...props} isPaused isNextBattleReady />,
    )
    expect(
      container.querySelectorAll('[data-playback-mode="static"]'),
    ).toHaveLength(2)
    expect(getRole(container, "first")).toHaveAttribute(
      "data-battle-role",
      "rest",
    )
    expect(getRole(container, "second")).toHaveAttribute(
      "data-battle-role",
      "rest",
    )
    expect(props.onResultAnimationComplete).not.toHaveBeenCalled()
  })
})

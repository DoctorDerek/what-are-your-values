import { createSeethingSwarmTypographyOnlyRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import {
  getValueDisplayDefinition,
  getValueDisplayName,
} from "@game/data/src/Value"
import { ACHIEVEMENT_CATALOG } from "@game/machines/src/AchievementCatalog"
import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import { getValueChoiceAccessibilityLabel } from "@game/machines/src/BattleAccessibilityPresentation"
import {
  createBattleCycleCandidate,
  createInitialBattleCycle,
} from "@game/machines/src/BattleCycle"
import { projectBattlePair } from "@game/machines/src/BattleScheduler"
import type { PresentedBattle } from "@game/machines/src/CombatMachine"
import { projectScheduledPair } from "@game/machines/src/PairScheduler"
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import Crucible from "./Crucible"

const VALUE_CHOICE_ACCESSIBLE_NAME_PATTERN =
  /^Choose .+\. Level \d+\. Choice [12]\.$/

function createBattleProps(seed: string) {
  const battleCycle = createInitialBattleCycle(seed)
  const battle = Object.freeze({
    pair: projectScheduledPair(battleCycle.activeDeck, battleCycle.scheduler)
      .pair,
    scheduler: battleCycle.scheduler,
  }) satisfies PresentedBattle

  return { battleCycle, battle }
}

function createBattleTransitionProps(seed: string) {
  const { battleCycle, battle } = createBattleProps(seed)
  const winnerId = battle.pair[0]
  const resultingBattleCycle = createBattleCycleCandidate({
    battleCycle,
    winnerId,
    expectedScheduler: battle.scheduler,
  })
  const resultingBattle = Object.freeze({
    pair: projectBattlePair(
      resultingBattleCycle.activeDeck,
      resultingBattleCycle.scheduler,
    ),
    scheduler: resultingBattleCycle.scheduler,
  }) satisfies PresentedBattle
  const winner = battleCycle.activeDeck.values.find(({ id }) => id === winnerId)
  if (!winner) throw new Error("Projected winner definition is missing")

  return { battleCycle, battle, resultingBattleCycle, resultingBattle, winner }
}

function getPresentedCombatantIds(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>("[data-combatant-side]"),
  ).map((combatant) => combatant.dataset.valueId)
}

function createHistoryProps() {
  return {
    achievement: null,
    canUndo: false,
    canRedo: false,
    controlHintPreference: "auto" as const,
    isAchievementAcknowledgementPending: false,
    isMenuOpen: false,
    isPersistencePending: false,
    shouldReduceMotion: false,
    runtimeClipCatalog: createSeethingSwarmTypographyOnlyRuntimeClipCatalog(),
    onAchievementPresented: vi.fn(),
    onOpenMenu: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
  }
}

const firstAchievement = ACHIEVEMENT_CATALOG[0]
const firstAchievementPresentation = Object.freeze({
  id: firstAchievement.id,
  title: "First Battle",
  requirement: "Compare your first pair of values.",
  status: "unlocked",
  progress: null,
  unlockedAt: "2026-08-07T12:34:56.000Z",
  unlockedDate: "Aug 7, 2026",
}) satisfies AchievementPresentation

describe("Crucible Component Integration", () => {
  afterEach(() => vi.restoreAllMocks())

  it("keeps battle feedback in flow between controls and playable value cards", () => {
    const { battleCycle, battle } = createBattleProps(
      "achievement-banner-space-seed",
    )

    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        achievement={firstAchievementPresentation}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={vi.fn()}
        onWinnerSelected={vi.fn()}
      />,
    )

    const battleSurface = screen.getByRole("main", { name: "Value battle" })
    const battleActions = screen.getByRole("navigation", {
      name: "Battle actions",
    })
    const banner = screen.getByRole("complementary", {
      name: "Achievement unlocked",
    })
    const presentationRegion = banner.parentElement

    expect(battleSurface).toHaveAttribute("data-slot", "mapache-screen")
    expect(battleSurface).toHaveClass(
      "h-[100dvh]",
      "overflow-hidden",
      "[--mapache-screen-spacing:0px]",
    )
    expect(battleActions).toHaveClass("relative", "shrink-0")
    expect(banner).toHaveClass("relative")
    expect(presentationRegion).toHaveClass(
      "pointer-events-none",
      "relative",
      "shrink-0",
      "flex-col",
    )
    expect(presentationRegion).not.toHaveClass("absolute")
    expect(presentationRegion).toContainElement(battleActions)
    expect(presentationRegion?.nextElementSibling).toHaveClass(
      "min-h-0",
      "flex-1",
      "flex-col",
      "xl:grid",
      "xl:grid-cols-2",
    )
  })

  it("groups each shortcut, wrapping value name, and level in one identity rail", async () => {
    const { battleCycle, battle } = createBattleProps("identity-rail-seed")
    const firstDefinition = battleCycle.activeDeck.values.find(
      ({ id }) => id === battle.pair[0],
    )
    const secondDefinition = battleCycle.activeDeck.values.find(
      ({ id }) => id === battle.pair[1],
    )
    if (!firstDefinition || !secondDefinition)
      throw new Error("Projected value definitions are missing")

    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={vi.fn()}
        onWinnerSelected={vi.fn()}
      />,
    )

    const choice = await screen.findByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "first",
        value: firstDefinition,
        level: 1,
      }),
    })
    const heading = within(choice).getByRole("heading", {
      name: getValueDisplayName(firstDefinition),
    })
    const identityRail = heading.parentElement
    if (!identityRail)
      throw new Error("Value heading is missing its identity rail")

    expect(identityRail).toHaveClass(
      "grid",
      "grid-cols-[auto_minmax(0,1fr)_auto]",
      "xl:gap-5",
    )
    const firstControlHint = within(identityRail).getByText("[1 / A]")
    expect(firstControlHint).toBeVisible()
    expect(firstControlHint).toHaveClass("text-black")
    expect(firstControlHint).not.toHaveClass("text-white")
    expect(within(identityRail).getByText(/^LVL \d+$/)).toBeVisible()
    expect(heading).toHaveClass("break-words", "[overflow-wrap:anywhere]")

    const secondChoice = screen.getByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "second",
        value: secondDefinition,
        level: 1,
      }),
    })
    const secondControlHint = within(secondChoice).getByText("[2 / D]")
    expect(secondControlHint).toHaveClass("text-white")
    expect(secondControlHint).not.toHaveClass("text-black")
  })

  it("changes Auto hints only after intentional keyboard or pointer input without moving the identity rail", async () => {
    vi.spyOn(navigator, "maxTouchPoints", "get").mockReturnValue(1)
    const { battleCycle, battle } = createBattleProps("auto-hint-modality-seed")
    const firstDefinition = battleCycle.activeDeck.values.find(
      ({ id }) => id === battle.pair[0],
    )
    if (!firstDefinition)
      throw new Error("Projected value definition is missing")

    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={vi.fn()}
        onWinnerSelected={vi.fn()}
      />,
    )

    const choice = await screen.findByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "first",
        value: firstDefinition,
        level: 1,
      }),
    })
    const hint = within(choice).getByText("[1 / A]")
    const menuHint = screen.getByText("[ESC]")
    await waitFor(() => expect(hint).toHaveClass("invisible"))
    expect(menuHint).toHaveClass("xl:invisible")
    fireEvent.mouseMove(window)
    fireEvent.keyDown(window, { key: "Shift" })
    expect(hint).toHaveClass("invisible")

    fireEvent.keyDown(window, { key: "ArrowRight" })
    await waitFor(() => expect(hint).not.toHaveClass("invisible"))
    expect(menuHint).not.toHaveClass("xl:invisible")
    expect(hint).toHaveClass("w-16", "xl:w-28")
    act(() => window.dispatchEvent(new Event("pointerdown")))
    await waitFor(() => expect(hint).toHaveClass("invisible"))
    expect(menuHint).toHaveClass("xl:invisible")
  })

  it("shows the applicable fixed-width Tap hint for Always and reserves that rail for Off", async () => {
    vi.spyOn(navigator, "maxTouchPoints", "get").mockReturnValue(1)
    const { battleCycle, battle } = createBattleProps("explicit-hint-seed")
    const firstDefinition = battleCycle.activeDeck.values.find(
      ({ id }) => id === battle.pair[0],
    )
    if (!firstDefinition)
      throw new Error("Projected value definition is missing")
    const baseProps = {
      ...createHistoryProps(),
      activeDeck: battleCycle.activeDeck,
      battle,
      progressById: battleCycle.progressById,
      onExit: vi.fn(),
      onWinnerSelected: vi.fn(),
    }
    const { rerender } = render(
      <Crucible {...baseProps} controlHintPreference="always" />,
    )

    const choice = await screen.findByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "first",
        value: firstDefinition,
        level: 1,
      }),
    })
    const tapHint = within(choice).getByText("Tap")
    expect(tapHint).not.toHaveClass("invisible")
    expect(tapHint).toHaveClass("w-16", "xl:w-28")

    rerender(<Crucible {...baseProps} controlHintPreference="off" />)
    const reservedHint = within(choice).getByText("[1 / A]")
    expect(reservedHint).toHaveClass("invisible", "w-16", "xl:w-28")
  })

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
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={vi.fn()}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText(getValueDisplayName(winner))).toBeVisible()
      expect(screen.getByText(getValueDisplayName(loser))).toBeVisible()
    })

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

  it("commits the first pointer activation exactly once", async () => {
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps("pointer-battle-seed")
    const [winnerId] = battle.pair
    const winner = battleCycle.activeDeck.values.find(
      ({ id }) => id === winnerId,
    )
    if (!winner) {
      throw new Error("Projected winner definition is missing")
    }

    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={vi.fn()}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    const cardA = await screen.findByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "first",
        value: winner,
        level: 1,
      }),
    })

    act(() => cardA.click())
    expect(onWinnerSelected).toHaveBeenCalledWith(winnerId, battle.scheduler)

    act(() => cardA.click())
    expect(onWinnerSelected).toHaveBeenCalledTimes(1)
  })

  it("holds the current pair through rapid input until both battle visuals finish", async () => {
    const onWinnerSelected = vi.fn()
    const {
      battleCycle,
      battle,
      resultingBattleCycle,
      resultingBattle,
      winner,
    } = createBattleTransitionProps("battle-stage-rapid-input-seed")

    const props = {
      ...createHistoryProps(),
      activeDeck: battleCycle.activeDeck,
      battle,
      progressById: battleCycle.progressById,
      onExit: vi.fn(),
      onWinnerSelected,
    }
    const { container, rerender } = render(<Crucible {...props} />)
    const firstChoice = await screen.findByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "first",
        value: winner,
        level: 1,
      }),
    })

    fireEvent.click(firstChoice)
    fireEvent.click(firstChoice)
    fireEvent.keyDown(window, { key: "2" })
    expect(onWinnerSelected).toHaveBeenCalledTimes(1)

    rerender(
      <Crucible
        {...props}
        battle={resultingBattle}
        progressById={resultingBattleCycle.progressById}
      />,
    )
    expect(firstChoice).toBeInTheDocument()
    const resultVisuals = container.querySelectorAll(
      '[data-placeholder-playback="one-shot"]',
    )
    expect(resultVisuals).toHaveLength(2)
    expect(getPresentedCombatantIds(container)).toEqual(battle.pair)

    fireEvent.animationEnd(resultVisuals[0]!)
    expect(getPresentedCombatantIds(container)).toEqual(battle.pair)
    fireEvent.animationEnd(resultVisuals[1]!)

    await waitFor(() =>
      expect(getPresentedCombatantIds(container)).toEqual(resultingBattle.pair),
    )
    expect(
      container.querySelector("[data-battle-stage-state]"),
    ).toHaveAttribute("data-battle-stage-state", "awaiting-input")
    expect(onWinnerSelected).toHaveBeenCalledTimes(1)
  })

  it("keeps decorative static combatants and advances a durable Reduced Motion result", async () => {
    const onWinnerSelected = vi.fn()
    const {
      battleCycle,
      battle,
      resultingBattleCycle,
      resultingBattle,
      winner,
    } = createBattleTransitionProps("battle-stage-reduced-motion-seed")

    const props = {
      ...createHistoryProps(),
      activeDeck: battleCycle.activeDeck,
      battle,
      progressById: battleCycle.progressById,
      shouldReduceMotion: true,
      onExit: vi.fn(),
      onWinnerSelected,
    }
    const { container, rerender } = render(<Crucible {...props} />)
    const firstChoice = await screen.findByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "first",
        value: winner,
        level: 1,
      }),
    })
    const stage = container.querySelector("[data-battle-stage-state]")
    expect(stage).toHaveAttribute("aria-hidden", "true")
    expect(
      container.querySelectorAll('[data-placeholder-playback="static"]'),
    ).toHaveLength(2)

    fireEvent.click(firstChoice)
    rerender(
      <Crucible
        {...props}
        battle={resultingBattle}
        progressById={resultingBattleCycle.progressById}
      />,
    )

    await waitFor(() =>
      expect(getPresentedCombatantIds(container)).toEqual(resultingBattle.pair),
    )
    expect(
      screen.getAllByRole("button", {
        name: VALUE_CHOICE_ACCESSIBLE_NAME_PATTERN,
      }),
    ).toHaveLength(2)
    expect(onWinnerSelected).toHaveBeenCalledTimes(1)
  })

  it("shows the definition inside the one-tap value choice", async () => {
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps("definition-battle-seed")
    const [valueId] = battle.pair
    const definition = battleCycle.activeDeck.values.find(
      ({ id }) => id === valueId,
    )
    if (!definition) {
      throw new Error("Projected value definition is missing")
    }

    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={vi.fn()}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    const choice = await screen.findByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "first",
        value: definition,
        level: 1,
      }),
    })
    const definitionCopy = screen.getByText(
      `“${getValueDisplayDefinition(definition)}”`,
    )

    expect(choice).toHaveAccessibleDescription(
      `“${getValueDisplayDefinition(definition)}”`,
    )
    expect(choice).toContainElement(definitionCopy)
    expect(document.querySelector("details")).not.toBeInTheDocument()
    expect(screen.queryByText(/^Definition of /)).not.toBeInTheDocument()
    fireEvent.click(definitionCopy)
    expect(onWinnerSelected).toHaveBeenCalledTimes(1)
  })

  it("ignores keyboard events already consumed by an open dialog", async () => {
    const { battleCycle, battle } = createBattleProps("consumed-dialog-key")
    const onOpenMenu = vi.fn()
    const onWinnerSelected = vi.fn()
    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={vi.fn()}
        onOpenMenu={onOpenMenu}
        onWinnerSelected={onWinnerSelected}
      />,
    )
    await screen.findAllByRole("button", {
      name: VALUE_CHOICE_ACCESSIBLE_NAME_PATTERN,
    })
    for (const key of ["Escape", "1", "2"]) {
      const event = new KeyboardEvent("keydown", { key, cancelable: true })
      event.preventDefault()
      fireEvent(window, event)
    }
    expect(onOpenMenu).not.toHaveBeenCalled()
    expect(onWinnerSelected).not.toHaveBeenCalled()
  })

  it("supports arrow focus, keyboard confirmation, and Escape", async () => {
    const onExit = vi.fn()
    const onOpenMenu = vi.fn()
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps("navigation-battle-seed")
    const [, winnerId] = battle.pair

    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={onExit}
        onOpenMenu={onOpenMenu}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    const winner = battleCycle.activeDeck.values.find(
      ({ id }) => id === winnerId,
    )
    if (!winner) {
      throw new Error("Projected winner definition is missing")
    }
    const cardB = await screen.findByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "second",
        value: winner,
        level: 1,
      }),
    })

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
    })
    expect(cardB.className).toContain("ring-8")
    expect(cardB).toHaveFocus()

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    })

    expect(onWinnerSelected).toHaveBeenCalledWith(winnerId, battle.scheduler)
    expect(onOpenMenu).toHaveBeenCalledTimes(1)
    expect(onExit).not.toHaveBeenCalled()
  })

  it("keeps both value cards vertically readable without horizontal overflow", async () => {
    const { battleCycle, battle } = createBattleProps("readable-copy-seed")
    const definitions = battle.pair.map((valueId) => {
      const definition = battleCycle.activeDeck.values.find(
        ({ id }) => id === valueId,
      )
      if (!definition) {
        throw new Error("Projected value definition is missing")
      }

      return definition
    })

    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={vi.fn()}
        onWinnerSelected={vi.fn()}
      />,
    )

    expect(screen.getByRole("main", { name: "Value battle" })).toHaveClass(
      "overflow-hidden",
      "overscroll-none",
      "select-none",
      "touch-manipulation",
    )

    for (const [index, definition] of definitions.entries()) {
      const choice = await screen.findByRole("button", {
        name: getValueChoiceAccessibilityLabel({
          position: index === 0 ? "first" : "second",
          value: definition,
          level: 1,
        }),
      })
      const heading = screen.getByRole("heading", {
        name: getValueDisplayName(definition),
      })
      const definitionCopy = screen.getByText(
        `“${getValueDisplayDefinition(definition)}”`,
      )

      expect(choice.parentElement).toHaveClass(
        "min-h-0",
        "min-w-0",
        "overflow-x-hidden",
        "overflow-y-auto",
        "overscroll-contain",
      )
      expect(heading).toHaveClass("break-words", "[overflow-wrap:anywhere]")
      expect(definitionCopy).toHaveClass(
        "break-words",
        "[overflow-wrap:anywhere]",
      )
    }
  })

  it("routes one Undo and blocks competing actions until completion", async () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps("history-control-seed")
    const firstDefinition = battleCycle.activeDeck.values.find(
      ({ id }) => id === battle.pair[0],
    )
    if (!firstDefinition) {
      throw new Error("Projected value definition is missing")
    }

    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        canUndo
        canRedo
        onExit={vi.fn()}
        onUndo={onUndo}
        onRedo={onRedo}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    await screen.findByRole("button", {
      name: getValueChoiceAccessibilityLabel({
        position: "first",
        value: firstDefinition,
        level: 1,
      }),
    })

    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    fireEvent.keyDown(window, { key: "y" })
    fireEvent.keyDown(window, { key: "z", repeat: true })

    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onRedo).not.toHaveBeenCalled()
    expect(onWinnerSelected).not.toHaveBeenCalled()
  })

  it("routes one keyboard Redo and blocks competing shortcuts until completion", async () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps(
      "keyboard-history-shortcuts-seed",
    )
    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        canUndo
        canRedo
        onExit={vi.fn()}
        onUndo={onUndo}
        onRedo={onRedo}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    await screen.findAllByRole("button", {
      name: VALUE_CHOICE_ACCESSIBLE_NAME_PATTERN,
    })

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "z",
          shiftKey: true,
          ctrlKey: true,
        }),
      )
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "z" }))
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "2" }))
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }))
    })

    expect(onUndo).not.toHaveBeenCalled()
    expect(onRedo).toHaveBeenCalledTimes(1)
    expect(onWinnerSelected).not.toHaveBeenCalled()
  })

  it("disables every battle action while a durable write is pending", async () => {
    const onExit = vi.fn()
    const onOpenMenu = vi.fn()
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps(
      "pending-persistence-seed",
    )

    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        canUndo
        canRedo
        isPersistencePending
        onExit={onExit}
        onOpenMenu={onOpenMenu}
        onUndo={onUndo}
        onRedo={onRedo}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    await screen.findAllByRole("button", {
      name: VALUE_CHOICE_ACCESSIBLE_NAME_PATTERN,
    })
    expect(screen.getByRole("main", { name: "Value battle" })).toHaveAttribute(
      "aria-busy",
      "true",
    )
    screen.getAllByRole("button").forEach((button) => {
      expect(button).toBeDisabled()
      fireEvent.click(button)
    })
    fireEvent.keyDown(window, { key: "1" })
    fireEvent.keyDown(window, { key: "z" })
    fireEvent.keyDown(window, { key: "y" })
    fireEvent.keyDown(window, { key: "Escape" })

    expect(onExit).not.toHaveBeenCalled()
    expect(onOpenMenu).not.toHaveBeenCalled()
    expect(onUndo).not.toHaveBeenCalled()
    expect(onRedo).not.toHaveBeenCalled()
    expect(onWinnerSelected).not.toHaveBeenCalled()
  })
})

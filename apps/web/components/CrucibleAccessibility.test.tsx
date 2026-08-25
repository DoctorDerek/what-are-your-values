import {
  getValueDisplayDefinition,
  getValueDisplayName,
  type ActiveValueDefinition,
  type ValueId,
} from "@game/data/src/Value"
import {
  createBattleCycleCandidate,
  createInitialBattleCycle,
  type BattleCycleState,
} from "@game/machines/src/BattleCycle"
import { projectBattlePair } from "@game/machines/src/BattleScheduler"
import type { PresentedBattle } from "@game/machines/src/CombatMachine"
import { getLevelFromXP } from "@game/utils/src/LevelMath"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import type { ComponentProps, HTMLAttributes, PropsWithChildren } from "react"
import { describe, expect, it, vi } from "vitest"
import Crucible from "./Crucible"

type MotionElementProps<TElement extends HTMLElement> = PropsWithChildren<
  Omit<HTMLAttributes<TElement>, "onAnimationComplete"> & {
    readonly layout?: boolean
    readonly initial?: unknown
    readonly animate?: unknown
    readonly exit?: unknown
    readonly transition?: unknown
    readonly onAnimationComplete?: () => void
  }
>

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: PropsWithChildren) => children,
  motion: {
    aside: ({
      children,
      initial,
      animate,
      transition,
      onAnimationComplete,
      ...props
    }: MotionElementProps<HTMLElement>) => (
      <aside {...props} onTransitionEnd={onAnimationComplete}>
        {children}
      </aside>
    ),
    div: ({
      children,
      layout,
      initial,
      animate,
      exit,
      transition,
      onAnimationComplete,
      ...props
    }: MotionElementProps<HTMLDivElement>) => (
      <div {...props} onTransitionEnd={onAnimationComplete}>
        {children}
      </div>
    ),
  },
}))

function createPresentedBattle({
  activeDeck,
  scheduler,
}: Pick<BattleCycleState, "activeDeck" | "scheduler">) {
  return Object.freeze({
    pair: projectBattlePair(activeDeck, scheduler),
    scheduler,
  }) satisfies PresentedBattle
}

function getActiveValueDefinition(
  activeDeck: BattleCycleState["activeDeck"],
  valueId: ValueId,
) {
  const value = activeDeck.values.find(({ id }) => id === valueId)
  if (!value) throw new Error(`Projected value is missing: ${valueId}`)

  return value
}

function getExpectedChoiceLabel({
  position,
  value,
  totalXp,
}: {
  readonly position: "first" | "second"
  readonly value: ActiveValueDefinition
  readonly totalXp: number
}) {
  const positionLabel = position === "first" ? "First" : "Second"

  return `Choose ${getValueDisplayName(value)}. Level ${getLevelFromXP(totalXp)}. ${positionLabel} choice.`
}

function createBattleAccessibilityFixture(seed: string) {
  const initialBattleCycle = createInitialBattleCycle(seed)
  const initialBattle = createPresentedBattle(initialBattleCycle)
  const winnerId = initialBattle.pair[0]
  const resultingBattleCycle = createBattleCycleCandidate({
    battleCycle: initialBattleCycle,
    winnerId,
    expectedScheduler: initialBattleCycle.scheduler,
  })
  const resultingBattle = createPresentedBattle(resultingBattleCycle)
  const winner = getActiveValueDefinition(
    initialBattleCycle.activeDeck,
    winnerId,
  )
  const priorWinnerTotalXp = initialBattleCycle.progressById.get(winnerId)
  const resultingWinnerTotalXp = resultingBattleCycle.progressById.get(winnerId)
  if (!priorWinnerTotalXp || !resultingWinnerTotalXp) {
    throw new Error("Winner progress is missing from the battle fixture")
  }

  return Object.freeze({
    initialBattleCycle,
    initialBattle,
    resultingBattleCycle,
    resultingBattle,
    winnerId,
    winner,
    earnedXp: resultingWinnerTotalXp.totalXp - priorWinnerTotalXp.totalXp,
  })
}

function createCrucibleProps(
  fixture: ReturnType<typeof createBattleAccessibilityFixture>,
) {
  return {
    activeDeck: fixture.initialBattleCycle.activeDeck,
    achievement: null,
    battle: fixture.initialBattle,
    progressById: fixture.initialBattleCycle.progressById,
    canUndo: false,
    canRedo: false,
    controlHintPreference: "auto",
    isAchievementAcknowledgementPending: false,
    isMenuOpen: false,
    isPersistencePending: false,
    shouldReduceMotion: true,
    onAchievementPresented: vi.fn(),
    onExit: vi.fn(),
    onOpenMenu: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onWinnerSelected: vi.fn(),
  } satisfies ComponentProps<typeof Crucible>
}

function getBattleStatus() {
  return within(screen.getByRole("main", { name: "Value battle" })).getByRole(
    "status",
  )
}

function getChoice({
  position,
  battle,
  progressById,
  activeDeck,
}: {
  readonly position: "first" | "second"
  readonly battle: PresentedBattle
  readonly progressById: ReturnType<
    typeof createInitialBattleCycle
  >["progressById"]
  readonly activeDeck: ReturnType<typeof createInitialBattleCycle>["activeDeck"]
}) {
  const valueId = battle.pair[position === "first" ? 0 : 1]
  const value = getActiveValueDefinition(activeDeck, valueId)
  const progress = progressById.get(valueId)
  if (!progress) throw new Error(`Projected progress is missing: ${valueId}`)

  return screen.getByRole("button", {
    name: getExpectedChoiceLabel({
      position,
      value,
      totalXp: progress.totalXp,
    }),
  })
}

function getComparisonCopy(
  activeDeck: ReturnType<typeof createInitialBattleCycle>["activeDeck"],
  battle: PresentedBattle,
) {
  const first = getActiveValueDefinition(activeDeck, battle.pair[0])
  const second = getActiveValueDefinition(activeDeck, battle.pair[1])

  return `${getValueDisplayName(first)} or ${getValueDisplayName(second)}`
}

describe("Crucible accessibility integration", () => {
  it("exposes exact choice semantics without initial focus theft or status noise", async () => {
    const fixture = createBattleAccessibilityFixture("semantic-choice-seed")
    const props = createCrucibleProps(fixture)

    render(<Crucible {...props} />)

    const status = getBattleStatus()
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(status).toHaveAttribute("aria-atomic", "true")
    expect(status).toBeEmptyDOMElement()
    expect(document.activeElement).toBe(document.body)

    for (const position of ["first", "second"] as const) {
      const choice = await waitFor(() =>
        getChoice({
          position,
          battle: fixture.initialBattle,
          progressById: fixture.initialBattleCycle.progressById,
          activeDeck: fixture.initialBattleCycle.activeDeck,
        }),
      )
      const value = getActiveValueDefinition(
        fixture.initialBattleCycle.activeDeck,
        fixture.initialBattle.pair[position === "first" ? 0 : 1],
      )

      expect(choice).toHaveAccessibleDescription(
        `“${getValueDisplayDefinition(value)}”`,
      )
    }
  })

  it("waits for every durable selection boundary and refreshes repeated status copy", async () => {
    const fixture = createBattleAccessibilityFixture(
      "durable-selection-announcement-seed",
    )
    const props = createCrucibleProps(fixture)
    const { rerender } = render(<Crucible {...props} />)
    const status = getBattleStatus()
    const initialFirstChoice = await waitFor(() =>
      getChoice({
        position: "first",
        battle: fixture.initialBattle,
        progressById: fixture.initialBattleCycle.progressById,
        activeDeck: fixture.initialBattleCycle.activeDeck,
      }),
    )

    fireEvent.click(initialFirstChoice)
    expect(props.onWinnerSelected).toHaveBeenCalledTimes(1)
    expect(props.onWinnerSelected).toHaveBeenCalledWith(
      fixture.winnerId,
      fixture.initialBattle.scheduler,
    )
    expect(status).toBeEmptyDOMElement()

    rerender(
      <Crucible
        {...props}
        battle={fixture.resultingBattle}
        progressById={fixture.resultingBattleCycle.progressById}
        canUndo
        isMenuOpen
        isPersistencePending
      />,
    )
    const initialMotionContainer = initialFirstChoice.parentElement
    if (!initialMotionContainer) {
      throw new Error("Initial choice is missing its motion container")
    }
    fireEvent.transitionEnd(initialMotionContainer)
    expect(status).toBeEmptyDOMElement()

    rerender(
      <Crucible
        {...props}
        battle={fixture.resultingBattle}
        progressById={fixture.resultingBattleCycle.progressById}
        canUndo
        isMenuOpen
      />,
    )
    expect(status).toBeEmptyDOMElement()

    rerender(
      <Crucible
        {...props}
        battle={fixture.resultingBattle}
        progressById={fixture.resultingBattleCycle.progressById}
        canUndo
      />,
    )
    const expectedSelectionMessage = `${getValueDisplayName(fixture.winner)} chosen. ${fixture.earnedXp} XP earned. Next: ${getComparisonCopy(fixture.initialBattleCycle.activeDeck, fixture.resultingBattle)}.`
    const resultingFirstChoice = await waitFor(() => {
      expect(status).toHaveTextContent(expectedSelectionMessage)

      return getChoice({
        position: "first",
        battle: fixture.resultingBattle,
        progressById: fixture.resultingBattleCycle.progressById,
        activeDeck: fixture.initialBattleCycle.activeDeck,
      })
    })
    expect(resultingFirstChoice).toHaveFocus()
    const firstSelectionStatusChild = status.firstElementChild
    if (!firstSelectionStatusChild) {
      throw new Error("Selection announcement is missing its keyed child")
    }

    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    expect(props.onUndo).toHaveBeenCalledTimes(1)
    rerender(
      <Crucible
        {...props}
        battle={fixture.initialBattle}
        progressById={fixture.initialBattleCycle.progressById}
        canRedo
        isPersistencePending
      />,
    )
    expect(status).toHaveTextContent(expectedSelectionMessage)

    rerender(
      <Crucible
        {...props}
        battle={fixture.initialBattle}
        progressById={fixture.initialBattleCycle.progressById}
        canRedo
      />,
    )
    const expectedUndoMessage = `Undo complete. ${fixture.earnedXp} XP removed from ${getValueDisplayName(fixture.winner)}. Restored: ${getComparisonCopy(fixture.initialBattleCycle.activeDeck, fixture.initialBattle)}.`
    const restoredFirstChoice = await waitFor(() => {
      expect(status).toHaveTextContent(expectedUndoMessage)

      return getChoice({
        position: "first",
        battle: fixture.initialBattle,
        progressById: fixture.initialBattleCycle.progressById,
        activeDeck: fixture.initialBattleCycle.activeDeck,
      })
    })
    expect(restoredFirstChoice).toHaveFocus()

    fireEvent.click(restoredFirstChoice)
    rerender(
      <Crucible
        {...props}
        battle={fixture.resultingBattle}
        progressById={fixture.resultingBattleCycle.progressById}
        canUndo
      />,
    )
    const restoredMotionContainer = restoredFirstChoice.parentElement
    if (!restoredMotionContainer) {
      throw new Error("Restored choice is missing its motion container")
    }
    fireEvent.transitionEnd(restoredMotionContainer)

    const repeatedSelectionStatusChild = await waitFor(() => {
      expect(status).toHaveTextContent(expectedSelectionMessage)

      return status.firstElementChild
    })
    expect(repeatedSelectionStatusChild).not.toBe(firstSelectionStatusChild)
    expect(props.onWinnerSelected).toHaveBeenCalledTimes(2)
  })

  it("announces Redo only after its restored durable result and focuses the next pair", async () => {
    const fixture = createBattleAccessibilityFixture("durable-redo-seed")
    const props = createCrucibleProps(fixture)
    const { rerender } = render(<Crucible {...props} canRedo />)
    const status = getBattleStatus()

    await waitFor(() =>
      getChoice({
        position: "first",
        battle: fixture.initialBattle,
        progressById: fixture.initialBattleCycle.progressById,
        activeDeck: fixture.initialBattleCycle.activeDeck,
      }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Redo" }))
    expect(props.onRedo).toHaveBeenCalledTimes(1)

    rerender(
      <Crucible
        {...props}
        battle={fixture.resultingBattle}
        progressById={fixture.resultingBattleCycle.progressById}
        canUndo
        isPersistencePending
      />,
    )
    expect(status).toBeEmptyDOMElement()

    rerender(
      <Crucible
        {...props}
        battle={fixture.resultingBattle}
        progressById={fixture.resultingBattleCycle.progressById}
        canUndo
      />,
    )
    const expectedRedoMessage = `Redo complete. ${fixture.earnedXp} XP restored to ${getValueDisplayName(fixture.winner)}. Next: ${getComparisonCopy(fixture.initialBattleCycle.activeDeck, fixture.resultingBattle)}.`
    const resultingFirstChoice = await waitFor(() => {
      expect(status).toHaveTextContent(expectedRedoMessage)

      return getChoice({
        position: "first",
        battle: fixture.resultingBattle,
        progressById: fixture.resultingBattleCycle.progressById,
        activeDeck: fixture.initialBattleCycle.activeDeck,
      })
    })
    expect(resultingFirstChoice).toHaveFocus()
  })
})

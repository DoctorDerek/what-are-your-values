import { createSeethingSwarmTypographyOnlyRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
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
import { describe, expect, it, jest } from "@jest/globals"
import {
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native"
import type { ComponentProps } from "react"
import { AccessibilityInfo } from "react-native"
import NativeCrucible from "@/components/NativeCrucible"

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
  const priorWinnerProgress = initialBattleCycle.progressById.get(winnerId)
  const resultingWinnerProgress =
    resultingBattleCycle.progressById.get(winnerId)
  if (!priorWinnerProgress || !resultingWinnerProgress) {
    throw new Error("Winner progress is missing from the battle fixture")
  }

  return Object.freeze({
    initialBattleCycle,
    initialBattle,
    resultingBattleCycle,
    resultingBattle,
    winnerId,
    winner,
    earnedXp: resultingWinnerProgress.totalXp - priorWinnerProgress.totalXp,
  })
}

function createNativeCrucibleProps(
  fixture: ReturnType<typeof createBattleAccessibilityFixture>,
) {
  return {
    activeDeck: fixture.initialBattleCycle.activeDeck,
    achievement: null,
    battle: fixture.initialBattle,
    runtimeClipCatalog: createSeethingSwarmTypographyOnlyRuntimeClipCatalog(),
    progressById: fixture.initialBattleCycle.progressById,
    canUndo: false,
    canRedo: false,
    controlHintPreference: "auto",
    isAchievementAcknowledgementPending: false,
    isMenuOpen: false,
    isPersistencePending: false,
    shouldReduceMotion: true,
    onAchievementPresented: jest.fn(),
    onExit: jest.fn(),
    onOpenMenu: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    onWinnerSelected: jest.fn(),
  } satisfies ComponentProps<typeof NativeCrucible>
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
  const choiceNumber = position === "first" ? 1 : 2

  return `Choose ${getValueDisplayName(value)}. Level ${getLevelFromXP(totalXp)}. Choice ${choiceNumber}.`
}

async function findChoice({
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
  readonly activeDeck: BattleCycleState["activeDeck"]
}) {
  const valueId = battle.pair[position === "first" ? 0 : 1]
  const value = getActiveValueDefinition(activeDeck, valueId)
  const progress = progressById.get(valueId)
  if (!progress) throw new Error(`Projected progress is missing: ${valueId}`)

  return screen.findByRole("button", {
    name: getExpectedChoiceLabel({
      position,
      value,
      totalXp: progress.totalXp,
    }),
  })
}

function getComparisonCopy(
  activeDeck: BattleCycleState["activeDeck"],
  battle: PresentedBattle,
) {
  const first = getActiveValueDefinition(activeDeck, battle.pair[0])
  const second = getActiveValueDefinition(activeDeck, battle.pair[1])

  return `${getValueDisplayName(first)} or ${getValueDisplayName(second)}`
}

function createAccessibilityTransportSpies() {
  return {
    focus: jest
      .spyOn(AccessibilityInfo, "sendAccessibilityEvent")
      .mockImplementation(() => undefined),
    announcement: jest
      .spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions")
      .mockImplementation(() => undefined),
  }
}

function expectFocusBeforeAnnouncement({
  focus,
  announcement,
  callIndex,
  expectedMessage,
}: {
  readonly focus: ReturnType<typeof createAccessibilityTransportSpies>["focus"]
  readonly announcement: ReturnType<
    typeof createAccessibilityTransportSpies
  >["announcement"]
  readonly callIndex: number
  readonly expectedMessage: string
}) {
  expect(focus.mock.calls[callIndex]?.[0]).toBeTruthy()
  expect(focus.mock.calls[callIndex]?.[1]).toBe("focus")
  expect(announcement.mock.calls[callIndex]).toEqual([
    expectedMessage,
    { queue: true },
  ])
  expect(focus.mock.invocationCallOrder[callIndex]).toBeLessThan(
    announcement.mock.invocationCallOrder[callIndex] ?? 0,
  )
}

describe("NativeCrucible accessibility integration", () => {
  it("exposes complete VoiceOver and TalkBack choice semantics without initial feedback", async () => {
    const fixture = createBattleAccessibilityFixture("native-semantics-seed")
    const props = createNativeCrucibleProps(fixture)
    const accessibility = createAccessibilityTransportSpies()

    await render(<NativeCrucible {...props} />)

    for (const position of ["first", "second"] as const) {
      const choice = await findChoice({
        position,
        battle: fixture.initialBattle,
        progressById: fixture.initialBattleCycle.progressById,
        activeDeck: fixture.initialBattleCycle.activeDeck,
      })
      const value = getActiveValueDefinition(
        fixture.initialBattleCycle.activeDeck,
        fixture.initialBattle.pair[position === "first" ? 0 : 1],
      )

      expect(choice).toBeEnabled()
      expect(choice).toHaveProp(
        "accessibilityHint",
        getValueDisplayDefinition(value),
      )
      expect(choice).toHaveProp("accessibilityRole", "button")
      expect(choice).toHaveProp("accessibilityState", {
        disabled: false,
        selected: false,
      })
    }

    expect(accessibility.focus).not.toHaveBeenCalled()
    expect(accessibility.announcement).not.toHaveBeenCalled()
  })

  it("waits for every durable selection boundary and repeats identical native feedback", async () => {
    const fixture = createBattleAccessibilityFixture(
      "native-durable-selection-seed",
    )
    const props = createNativeCrucibleProps(fixture)
    const accessibility = createAccessibilityTransportSpies()
    const user = userEvent.setup()
    const { rerender } = await render(<NativeCrucible {...props} />)
    const initialFirstChoice = await findChoice({
      position: "first",
      battle: fixture.initialBattle,
      progressById: fixture.initialBattleCycle.progressById,
      activeDeck: fixture.initialBattleCycle.activeDeck,
    })

    await user.press(initialFirstChoice)
    expect(props.onWinnerSelected).toHaveBeenCalledTimes(1)
    expect(props.onWinnerSelected).toHaveBeenCalledWith(
      fixture.winnerId,
      fixture.initialBattle.scheduler,
    )
    expect(accessibility.focus).not.toHaveBeenCalled()
    expect(accessibility.announcement).not.toHaveBeenCalled()

    await rerender(
      <NativeCrucible
        {...props}
        battle={fixture.resultingBattle}
        progressById={fixture.resultingBattleCycle.progressById}
        canUndo
        isMenuOpen
        isPersistencePending
      />,
    )
    expect(accessibility.focus).not.toHaveBeenCalled()
    expect(accessibility.announcement).not.toHaveBeenCalled()

    await rerender(
      <NativeCrucible
        {...props}
        battle={fixture.resultingBattle}
        progressById={fixture.resultingBattleCycle.progressById}
        canUndo
        isMenuOpen
      />,
    )
    expect(accessibility.focus).not.toHaveBeenCalled()
    expect(accessibility.announcement).not.toHaveBeenCalled()

    await rerender(
      <NativeCrucible
        {...props}
        battle={fixture.resultingBattle}
        progressById={fixture.resultingBattleCycle.progressById}
        canUndo
      />,
    )
    const expectedSelectionMessage = `${getValueDisplayName(fixture.winner)} chosen. ${fixture.earnedXp} XP earned. Next: ${getComparisonCopy(fixture.initialBattleCycle.activeDeck, fixture.resultingBattle)}.`
    await waitFor(() => {
      expect(accessibility.focus).toHaveBeenCalledTimes(1)
      expect(accessibility.announcement).toHaveBeenCalledTimes(1)
    })
    expectFocusBeforeAnnouncement({
      ...accessibility,
      callIndex: 0,
      expectedMessage: expectedSelectionMessage,
    })

    await user.press(screen.getByRole("button", { name: "Undo" }))
    await user.press(screen.getByRole("button", { name: "Redo" }))
    await user.press(
      await findChoice({
        position: "first",
        battle: fixture.resultingBattle,
        progressById: fixture.resultingBattleCycle.progressById,
        activeDeck: fixture.initialBattleCycle.activeDeck,
      }),
    )
    expect(props.onUndo).toHaveBeenCalledTimes(1)
    expect(props.onRedo).not.toHaveBeenCalled()
    expect(props.onWinnerSelected).toHaveBeenCalledTimes(1)

    await rerender(
      <NativeCrucible
        {...props}
        battle={fixture.initialBattle}
        progressById={fixture.initialBattleCycle.progressById}
        canRedo
        isPersistencePending
      />,
    )
    expect(accessibility.announcement).toHaveBeenCalledTimes(1)

    await rerender(
      <NativeCrucible
        {...props}
        battle={fixture.initialBattle}
        progressById={fixture.initialBattleCycle.progressById}
        canRedo
      />,
    )
    const expectedUndoMessage = `Undo complete. ${fixture.earnedXp} XP removed from ${getValueDisplayName(fixture.winner)}. Restored: ${getComparisonCopy(fixture.initialBattleCycle.activeDeck, fixture.initialBattle)}.`
    await waitFor(() => {
      expect(accessibility.focus).toHaveBeenCalledTimes(2)
      expect(accessibility.announcement).toHaveBeenCalledTimes(2)
    })
    expectFocusBeforeAnnouncement({
      ...accessibility,
      callIndex: 1,
      expectedMessage: expectedUndoMessage,
    })

    await user.press(
      await findChoice({
        position: "first",
        battle: fixture.initialBattle,
        progressById: fixture.initialBattleCycle.progressById,
        activeDeck: fixture.initialBattleCycle.activeDeck,
      }),
    )
    await rerender(
      <NativeCrucible
        {...props}
        battle={fixture.resultingBattle}
        progressById={fixture.resultingBattleCycle.progressById}
        canUndo
      />,
    )
    await waitFor(() => {
      expect(accessibility.focus).toHaveBeenCalledTimes(3)
      expect(accessibility.announcement).toHaveBeenCalledTimes(3)
    })
    expectFocusBeforeAnnouncement({
      ...accessibility,
      callIndex: 2,
      expectedMessage: expectedSelectionMessage,
    })
    expect(accessibility.announcement.mock.calls[2]?.[0]).toBe(
      accessibility.announcement.mock.calls[0]?.[0],
    )
    expect(props.onWinnerSelected).toHaveBeenCalledTimes(2)
  })

  it("announces Redo only after its durable result and blocks competing native actions", async () => {
    const fixture = createBattleAccessibilityFixture("native-redo-seed")
    const props = createNativeCrucibleProps(fixture)
    const accessibility = createAccessibilityTransportSpies()
    const user = userEvent.setup()
    const { rerender } = await render(
      <NativeCrucible {...props} canUndo canRedo />,
    )

    await findChoice({
      position: "first",
      battle: fixture.initialBattle,
      progressById: fixture.initialBattleCycle.progressById,
      activeDeck: fixture.initialBattleCycle.activeDeck,
    })
    await user.press(screen.getByRole("button", { name: "Redo" }))
    await user.press(screen.getByRole("button", { name: "Undo" }))
    await user.press(
      await findChoice({
        position: "first",
        battle: fixture.initialBattle,
        progressById: fixture.initialBattleCycle.progressById,
        activeDeck: fixture.initialBattleCycle.activeDeck,
      }),
    )
    expect(props.onRedo).toHaveBeenCalledTimes(1)
    expect(props.onUndo).not.toHaveBeenCalled()
    expect(props.onWinnerSelected).not.toHaveBeenCalled()

    await rerender(
      <NativeCrucible
        {...props}
        battle={fixture.resultingBattle}
        progressById={fixture.resultingBattleCycle.progressById}
        canUndo
        isPersistencePending
      />,
    )
    expect(accessibility.focus).not.toHaveBeenCalled()
    expect(accessibility.announcement).not.toHaveBeenCalled()

    await rerender(
      <NativeCrucible
        {...props}
        battle={fixture.resultingBattle}
        progressById={fixture.resultingBattleCycle.progressById}
        canUndo
      />,
    )
    const expectedRedoMessage = `Redo complete. ${fixture.earnedXp} XP restored to ${getValueDisplayName(fixture.winner)}. Next: ${getComparisonCopy(fixture.initialBattleCycle.activeDeck, fixture.resultingBattle)}.`
    await waitFor(() => {
      expect(accessibility.focus).toHaveBeenCalledTimes(1)
      expect(accessibility.announcement).toHaveBeenCalledTimes(1)
    })
    expectFocusBeforeAnnouncement({
      ...accessibility,
      callIndex: 0,
      expectedMessage: expectedRedoMessage,
    })
  })
})

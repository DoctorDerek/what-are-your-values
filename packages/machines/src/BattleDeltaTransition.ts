import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import {
  createValueProgressById,
  type ValueProgress,
  type ValueProgressById,
} from "@game/data/src/ValueProgress"
import type { BattleCycleState } from "./BattleCycle"
import {
  BATTLE_DELTA_VERSION,
  createBattleDelta,
  CYCLE_BOUNDARY_TRANSITION_VERSION,
  type BattleDelta,
  type CurrentCycleWinsById,
} from "./BattleDelta"
import {
  validateCycleLevelSnapshot,
  type CycleLevelSnapshot,
} from "./CycleLevelSnapshot"
import { areSchedulerIdentitiesEqual } from "./SchedulerIdentity"

function assertProgressEquals(
  actual: ValueProgress | undefined,
  expected: ValueProgress,
  valueId: ValueId,
  transitionLabel: string,
) {
  if (
    !actual ||
    actual.totalXp !== expected.totalXp ||
    actual.profileWins !== expected.profileWins ||
    actual.profileComparisons !== expected.profileComparisons ||
    actual.currentCycleWins !== expected.currentCycleWins
  ) {
    throw new Error(
      `${transitionLabel} progress does not match Battle Delta for ${valueId}`,
    )
  }
}

function validateCurrentCycleWinsById(
  activeDeck: ActiveDeck,
  currentCycleWinsById: CurrentCycleWinsById,
) {
  if (currentCycleWinsById.size !== activeDeck.valueIds.length) {
    throw new Error(
      "Battle Delta current-cycle wins do not cover the complete Active Deck",
    )
  }

  return new Map(
    activeDeck.valueIds.map((valueId) => {
      const currentCycleWins = currentCycleWinsById.get(valueId)

      if (
        currentCycleWins === undefined ||
        !Number.isSafeInteger(currentCycleWins) ||
        currentCycleWins < 0
      ) {
        throw new Error(
          `Invalid Battle Delta current-cycle wins for ${valueId}`,
        )
      }

      return [valueId, currentCycleWins] as const
    }),
  ) satisfies CurrentCycleWinsById
}

function getCurrentCycleWins(
  currentCycleWinsById: CurrentCycleWinsById,
  valueId: ValueId,
) {
  const currentCycleWins = currentCycleWinsById.get(valueId)

  if (currentCycleWins === undefined) {
    throw new Error(`Battle Delta current-cycle wins are missing ${valueId}`)
  }

  return currentCycleWins
}

function assertCurrentCycleWinsEqual(
  activeDeck: ActiveDeck,
  progressById: ValueProgressById,
  expectedCurrentCycleWinsById: CurrentCycleWinsById,
  transitionLabel: string,
) {
  const validatedCurrentCycleWinsById = validateCurrentCycleWinsById(
    activeDeck,
    expectedCurrentCycleWinsById,
  )

  activeDeck.valueIds.forEach((valueId) => {
    const progress = progressById.get(valueId)
    const expectedCurrentCycleWins = getCurrentCycleWins(
      validatedCurrentCycleWinsById,
      valueId,
    )

    if (!progress || progress.currentCycleWins !== expectedCurrentCycleWins) {
      throw new Error(
        `${transitionLabel} current-cycle wins do not match Battle Delta for ${valueId}`,
      )
    }
  })
}

function assertCycleLevelSnapshotsEqual(
  activeDeck: ActiveDeck,
  actual: CycleLevelSnapshot,
  expected: CycleLevelSnapshot,
  transitionLabel: string,
) {
  const validatedActual = validateCycleLevelSnapshot(activeDeck, actual)
  const validatedExpected = validateCycleLevelSnapshot(activeDeck, expected)

  if (
    activeDeck.valueIds.some(
      (valueId) =>
        validatedActual.get(valueId) !== validatedExpected.get(valueId),
    )
  ) {
    throw new Error(
      `${transitionLabel} cycle-level snapshot does not match Battle Delta`,
    )
  }
}

function assertBattleProgressDelta(delta: BattleDelta) {
  const pairContainsWinnerAndLoser =
    (delta.pair[0] === delta.winnerId && delta.pair[1] === delta.loserId) ||
    (delta.pair[1] === delta.winnerId && delta.pair[0] === delta.loserId)

  if (
    !pairContainsWinnerAndLoser ||
    delta.winnerId === delta.loserId ||
    !Number.isSafeInteger(delta.xpGained) ||
    delta.xpGained < 1 ||
    delta.resultingWinnerProgress.totalXp -
      delta.priorWinnerProgress.totalXp !==
      delta.xpGained ||
    delta.resultingWinnerProgress.profileWins -
      delta.priorWinnerProgress.profileWins !==
      1 ||
    delta.resultingWinnerProgress.profileComparisons -
      delta.priorWinnerProgress.profileComparisons !==
      1 ||
    delta.resultingWinnerProgress.currentCycleWins -
      delta.priorWinnerProgress.currentCycleWins !==
      1 ||
    delta.resultingLoserProgress.totalXp !== delta.priorLoserProgress.totalXp ||
    delta.resultingLoserProgress.profileWins !==
      delta.priorLoserProgress.profileWins ||
    delta.resultingLoserProgress.profileComparisons -
      delta.priorLoserProgress.profileComparisons !==
      1 ||
    delta.resultingLoserProgress.currentCycleWins !==
      delta.priorLoserProgress.currentCycleWins
  ) {
    throw new Error("Battle Delta progress transition is inconsistent")
  }
}

export function validateBattleDelta(
  activeDeck: ActiveDeck,
  delta: BattleDelta,
) {
  if (
    delta.version !== BATTLE_DELTA_VERSION ||
    (delta.cycleBoundary &&
      delta.cycleBoundary.version !== CYCLE_BOUNDARY_TRANSITION_VERSION)
  ) {
    throw new Error("Unsupported Battle Delta version")
  }

  assertBattleProgressDelta(delta)
  const validatedDelta = createBattleDelta({
    activeDeck,
    progressDelta: delta,
    priorScheduler: delta.priorScheduler,
    resultingScheduler: delta.resultingScheduler,
    cycleBoundary: delta.cycleBoundary,
  })

  if (
    activeDeck.fingerprint !== delta.activeDeckFingerprint ||
    delta.progressGeneration !== delta.priorScheduler.progressGeneration ||
    delta.deckRevision !== delta.priorScheduler.deckRevision ||
    delta.cycleIndex !== delta.priorScheduler.cycleIndex ||
    delta.battleId !== validatedDelta.battleId
  ) {
    throw new Error("Battle Delta identity does not match its profile boundary")
  }

  return validatedDelta
}

function replaceAffectedProgress({
  activeDeck,
  progressById,
  delta,
  winnerProgress,
  loserProgress,
  currentCycleWinsById,
}: {
  readonly activeDeck: ActiveDeck
  readonly progressById: ValueProgressById
  readonly delta: BattleDelta
  readonly winnerProgress: ValueProgress
  readonly loserProgress: ValueProgress
  readonly currentCycleWinsById: CurrentCycleWinsById | null
}) {
  const replacements = new Map(progressById)
  replacements.set(delta.winnerId, winnerProgress)
  replacements.set(delta.loserId, loserProgress)

  const validatedCurrentCycleWinsById = currentCycleWinsById
    ? validateCurrentCycleWinsById(activeDeck, currentCycleWinsById)
    : null

  return createValueProgressById(
    activeDeck,
    activeDeck.valueIds.map((valueId) => {
      const progress = replacements.get(valueId)

      if (!progress) {
        throw new Error(`Value Progress is missing ${valueId}`)
      }

      return [
        valueId,
        validatedCurrentCycleWinsById
          ? {
              ...progress,
              currentCycleWins: getCurrentCycleWins(
                validatedCurrentCycleWinsById,
                valueId,
              ),
            }
          : progress,
      ] as const
    }),
  )
}

export function undoBattleDelta({
  battleCycle,
  delta,
}: {
  readonly battleCycle: BattleCycleState
  readonly delta: BattleDelta
}) {
  validateBattleDelta(battleCycle.activeDeck, delta)

  if (
    !areSchedulerIdentitiesEqual(
      battleCycle.scheduler,
      delta.resultingScheduler,
    )
  ) {
    throw new Error("Undo requires the Battle Delta resulting scheduler")
  }

  if (delta.cycleBoundary) {
    assertCycleLevelSnapshotsEqual(
      battleCycle.activeDeck,
      battleCycle.cycleLevelSnapshot,
      delta.cycleBoundary.resultingCycleLevelSnapshot,
      "Undo",
    )
    assertCurrentCycleWinsEqual(
      battleCycle.activeDeck,
      battleCycle.progressById,
      delta.cycleBoundary.resultingCurrentCycleWinsById,
      "Undo",
    )
    assertProgressEquals(
      battleCycle.progressById.get(delta.winnerId),
      {
        ...delta.resultingWinnerProgress,
        currentCycleWins: getCurrentCycleWins(
          delta.cycleBoundary.resultingCurrentCycleWinsById,
          delta.winnerId,
        ),
      },
      delta.winnerId,
      "Undo",
    )
    assertProgressEquals(
      battleCycle.progressById.get(delta.loserId),
      {
        ...delta.resultingLoserProgress,
        currentCycleWins: getCurrentCycleWins(
          delta.cycleBoundary.resultingCurrentCycleWinsById,
          delta.loserId,
        ),
      },
      delta.loserId,
      "Undo",
    )
  } else {
    assertProgressEquals(
      battleCycle.progressById.get(delta.winnerId),
      delta.resultingWinnerProgress,
      delta.winnerId,
      "Undo",
    )
    assertProgressEquals(
      battleCycle.progressById.get(delta.loserId),
      delta.resultingLoserProgress,
      delta.loserId,
      "Undo",
    )
  }

  return Object.freeze({
    activeDeck: battleCycle.activeDeck,
    progressById: replaceAffectedProgress({
      activeDeck: battleCycle.activeDeck,
      progressById: battleCycle.progressById,
      delta,
      winnerProgress: delta.priorWinnerProgress,
      loserProgress: delta.priorLoserProgress,
      currentCycleWinsById:
        delta.cycleBoundary?.priorCurrentCycleWinsById ?? null,
    }),
    cycleLevelSnapshot: delta.cycleBoundary
      ? validateCycleLevelSnapshot(
          battleCycle.activeDeck,
          delta.cycleBoundary.priorCycleLevelSnapshot,
        )
      : battleCycle.cycleLevelSnapshot,
    scheduler: delta.priorScheduler,
  }) satisfies BattleCycleState
}

export function redoBattleDelta({
  battleCycle,
  delta,
}: {
  readonly battleCycle: BattleCycleState
  readonly delta: BattleDelta
}) {
  validateBattleDelta(battleCycle.activeDeck, delta)

  if (
    !areSchedulerIdentitiesEqual(battleCycle.scheduler, delta.priorScheduler)
  ) {
    throw new Error("Redo requires the Battle Delta prior scheduler")
  }

  assertProgressEquals(
    battleCycle.progressById.get(delta.winnerId),
    delta.priorWinnerProgress,
    delta.winnerId,
    "Redo",
  )
  assertProgressEquals(
    battleCycle.progressById.get(delta.loserId),
    delta.priorLoserProgress,
    delta.loserId,
    "Redo",
  )

  if (delta.cycleBoundary) {
    assertCycleLevelSnapshotsEqual(
      battleCycle.activeDeck,
      battleCycle.cycleLevelSnapshot,
      delta.cycleBoundary.priorCycleLevelSnapshot,
      "Redo",
    )
    assertCurrentCycleWinsEqual(
      battleCycle.activeDeck,
      battleCycle.progressById,
      delta.cycleBoundary.priorCurrentCycleWinsById,
      "Redo",
    )
  }

  return Object.freeze({
    activeDeck: battleCycle.activeDeck,
    progressById: replaceAffectedProgress({
      activeDeck: battleCycle.activeDeck,
      progressById: battleCycle.progressById,
      delta,
      winnerProgress: delta.resultingWinnerProgress,
      loserProgress: delta.resultingLoserProgress,
      currentCycleWinsById:
        delta.cycleBoundary?.resultingCurrentCycleWinsById ?? null,
    }),
    cycleLevelSnapshot: delta.cycleBoundary
      ? validateCycleLevelSnapshot(
          battleCycle.activeDeck,
          delta.cycleBoundary.resultingCycleLevelSnapshot,
        )
      : battleCycle.cycleLevelSnapshot,
    scheduler: delta.resultingScheduler,
  }) satisfies BattleCycleState
}

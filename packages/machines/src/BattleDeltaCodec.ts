import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import {
  BATTLE_DELTA_VERSION,
  createBattleDelta,
  CYCLE_BOUNDARY_TRANSITION_VERSION,
  type BattleDelta,
  type CurrentCycleWinsById,
  type CycleBoundaryTransition,
} from "./BattleDelta"
import { validateBattleDelta } from "./BattleDeltaTransition"
import {
  createBattleId,
  createCycleCompleteEventId,
  type CycleCompleteEventId,
} from "./BattleIdentity"
import {
  validateCyclePayoutTierSnapshot,
  type CyclePayoutTierSnapshot,
} from "./CyclePayoutTierSnapshot"
import {
  readActiveValueId,
  readNonNegativeSafeInteger,
  readPositiveSafeInteger,
  readString,
  readTuple,
} from "./PersistenceValidation"
import {
  decodeSchedulerRestorePoint,
  encodeSchedulerRestorePoint,
  type EncodedSchedulerRestorePoint,
} from "./SchedulerCodec"
import {
  decodeCompleteValueNumberMap,
  encodeValueNumberEntries,
  type EncodedValueNumberEntry,
} from "./ValueNumberMapCodec"
import {
  decodeValueProgress,
  encodeValueProgress,
  type EncodedValueProgress,
} from "./ValueProgressCodec"

type EncodedCycleBoundaryTransition = readonly [
  version: number,
  cycleCompleteEventId: string,
  priorCyclePayoutTierSnapshot: readonly EncodedValueNumberEntry[],
  resultingCyclePayoutTierSnapshot: readonly EncodedValueNumberEntry[],
  priorCurrentCycleWinsById: readonly EncodedValueNumberEntry[],
  resultingCurrentCycleWinsById: readonly EncodedValueNumberEntry[],
]

export type EncodedBattleDelta = readonly [
  version: number,
  battleId: string,
  progressGeneration: number,
  deckRevision: number,
  activeDeckFingerprint: string,
  cycleIndex: number,
  pair: readonly [firstValueId: string, secondValueId: string],
  winnerId: string,
  loserId: string,
  xpGained: number,
  priorWinnerProgress: EncodedValueProgress,
  resultingWinnerProgress: EncodedValueProgress,
  priorLoserProgress: EncodedValueProgress,
  resultingLoserProgress: EncodedValueProgress,
  priorScheduler: EncodedSchedulerRestorePoint,
  resultingScheduler: EncodedSchedulerRestorePoint,
  cycleBoundary: EncodedCycleBoundaryTransition | null,
]

function encodeCycleBoundaryTransition(
  boundary: CycleBoundaryTransition,
): EncodedCycleBoundaryTransition {
  return [
    boundary.version,
    boundary.cycleCompleteEventId,
    encodeValueNumberEntries(boundary.priorCyclePayoutTierSnapshot),
    encodeValueNumberEntries(boundary.resultingCyclePayoutTierSnapshot),
    encodeValueNumberEntries(boundary.priorCurrentCycleWinsById),
    encodeValueNumberEntries(boundary.resultingCurrentCycleWinsById),
  ]
}

export function encodeBattleDelta(delta: BattleDelta): EncodedBattleDelta {
  return [
    delta.version,
    delta.battleId,
    delta.progressGeneration,
    delta.deckRevision,
    delta.activeDeckFingerprint,
    delta.cycleIndex,
    [delta.pair[0], delta.pair[1]],
    delta.winnerId,
    delta.loserId,
    delta.xpGained,
    encodeValueProgress(delta.priorWinnerProgress),
    encodeValueProgress(delta.resultingWinnerProgress),
    encodeValueProgress(delta.priorLoserProgress),
    encodeValueProgress(delta.resultingLoserProgress),
    encodeSchedulerRestorePoint(delta.priorScheduler),
    encodeSchedulerRestorePoint(delta.resultingScheduler),
    delta.cycleBoundary
      ? encodeCycleBoundaryTransition(delta.cycleBoundary)
      : null,
  ]
}

export function getEncodedBattleDeltaByteLength(delta: BattleDelta) {
  return new TextEncoder().encode(JSON.stringify(encodeBattleDelta(delta)))
    .byteLength
}

function decodeCycleBoundaryTransition(
  activeDeck: ActiveDeck,
  value: unknown,
  expectedCycleCompleteEventId: CycleCompleteEventId,
) {
  if (value === null) {
    return null
  }

  const tuple = readTuple(value, 6, "Cycle Boundary Transition")
  const version = readNonNegativeSafeInteger(
    tuple[0],
    "Cycle Boundary Transition version",
  )
  const cycleCompleteEventId = readString(tuple[1], "cycle-complete event ID")
  if (version !== CYCLE_BOUNDARY_TRANSITION_VERSION) {
    throw new Error("Unsupported Cycle Boundary Transition version")
  }
  if (cycleCompleteEventId !== expectedCycleCompleteEventId) {
    throw new Error("Cycle-complete event identity is inconsistent")
  }

  const priorCyclePayoutTierSnapshot = validateCyclePayoutTierSnapshot(
    activeDeck,
    decodeCompleteValueNumberMap(
      activeDeck,
      tuple[2],
      "Prior Cycle Payout Tier Snapshot",
      1,
    ),
  ) satisfies CyclePayoutTierSnapshot
  const resultingCyclePayoutTierSnapshot = validateCyclePayoutTierSnapshot(
    activeDeck,
    decodeCompleteValueNumberMap(
      activeDeck,
      tuple[3],
      "Resulting Cycle Payout Tier Snapshot",
      1,
    ),
  ) satisfies CyclePayoutTierSnapshot
  const priorCurrentCycleWinsById = decodeCompleteValueNumberMap(
    activeDeck,
    tuple[4],
    "Prior current-cycle wins",
    0,
  ) satisfies CurrentCycleWinsById
  const resultingCurrentCycleWinsById = decodeCompleteValueNumberMap(
    activeDeck,
    tuple[5],
    "Resulting current-cycle wins",
    0,
  ) satisfies CurrentCycleWinsById

  return Object.freeze({
    version: CYCLE_BOUNDARY_TRANSITION_VERSION,
    cycleCompleteEventId: expectedCycleCompleteEventId,
    priorCyclePayoutTierSnapshot,
    resultingCyclePayoutTierSnapshot,
    priorCurrentCycleWinsById,
    resultingCurrentCycleWinsById,
  }) satisfies CycleBoundaryTransition
}

export function decodeBattleDelta(activeDeck: ActiveDeck, value: unknown) {
  const tuple = readTuple(value, 17, "Battle Delta")
  const version = readNonNegativeSafeInteger(tuple[0], "Battle Delta version")
  const battleId = readString(tuple[1], "Battle ID")
  const progressGeneration = readNonNegativeSafeInteger(
    tuple[2],
    "Battle Delta progress generation",
  )
  const deckRevision = readNonNegativeSafeInteger(
    tuple[3],
    "Battle Delta deck revision",
  )
  const activeDeckFingerprint = readString(
    tuple[4],
    "Battle Delta Active Deck fingerprint",
  )
  const cycleIndex = readNonNegativeSafeInteger(
    tuple[5],
    "Battle Delta cycle index",
  )
  const pairTuple = readTuple(tuple[6], 2, "Battle Delta pair")
  const pair = [
    readActiveValueId(activeDeck, pairTuple[0], "First pair Value ID"),
    readActiveValueId(activeDeck, pairTuple[1], "Second pair Value ID"),
  ] as const
  const winnerId = readActiveValueId(activeDeck, tuple[7], "Battle winner ID")
  const loserId = readActiveValueId(activeDeck, tuple[8], "Battle loser ID")
  const xpGained = readPositiveSafeInteger(tuple[9], "Battle XP gained")
  const priorScheduler = decodeSchedulerRestorePoint(
    activeDeck,
    tuple[14],
    "Prior scheduler",
  )
  const resultingScheduler = decodeSchedulerRestorePoint(
    activeDeck,
    tuple[15],
    "Resulting scheduler",
  )
  const expectedBattleId = createBattleId(priorScheduler)
  const cycleBoundary = decodeCycleBoundaryTransition(
    activeDeck,
    tuple[16],
    createCycleCompleteEventId(expectedBattleId),
  )

  if (version !== BATTLE_DELTA_VERSION) {
    throw new Error("Unsupported Battle Delta version")
  }

  const delta = validateBattleDelta(
    activeDeck,
    createBattleDelta({
      activeDeck,
      progressDelta: {
        pair,
        winnerId,
        loserId,
        xpGained,
        priorWinnerProgress: decodeValueProgress(
          winnerId,
          tuple[10],
          "Prior winner progress",
        ),
        resultingWinnerProgress: decodeValueProgress(
          winnerId,
          tuple[11],
          "Resulting winner progress",
        ),
        priorLoserProgress: decodeValueProgress(
          loserId,
          tuple[12],
          "Prior loser progress",
        ),
        resultingLoserProgress: decodeValueProgress(
          loserId,
          tuple[13],
          "Resulting loser progress",
        ),
      },
      priorScheduler,
      resultingScheduler,
      cycleBoundary,
    }),
  )

  if (
    battleId !== delta.battleId ||
    progressGeneration !== delta.progressGeneration ||
    deckRevision !== delta.deckRevision ||
    activeDeckFingerprint !== delta.activeDeckFingerprint ||
    cycleIndex !== delta.cycleIndex
  ) {
    throw new Error("Battle Delta identity does not match its encoded evidence")
  }

  if (JSON.stringify(encodeBattleDelta(delta)) !== JSON.stringify(value)) {
    throw new Error("Battle Delta encoding is not canonical")
  }

  return delta
}

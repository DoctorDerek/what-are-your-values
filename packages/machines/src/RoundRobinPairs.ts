import type { ValueId, ValuePair } from "@game/data/src/Value"
import { shuffleDeterministically } from "./DeterministicSequence"
import {
  orientValuePair,
  type PairOrientationContext,
} from "./PairOrientation"

const internalBye: unique symbol = Symbol("internal-bye")
type CircleParticipant = ValueId | typeof internalBye

function isActiveValue(participant: CircleParticipant): participant is ValueId {
  return participant !== internalBye
}

function rotateCircleParticipants(
  participants: readonly CircleParticipant[],
  sourceRoundIndex: number,
): CircleParticipant[] {
  const fixedParticipant = participants[0]
  const rotatingParticipants = participants.slice(1)
  const rotation = sourceRoundIndex % rotatingParticipants.length
  const splitIndex = rotatingParticipants.length - rotation

  return [
    fixedParticipant,
    ...rotatingParticipants.slice(splitIndex),
    ...rotatingParticipants.slice(0, splitIndex),
  ]
}

export function deriveRoundRobinPairs({
  participantOrder,
  sourceRoundIndex,
  orientation,
  cycleIndex,
  matchOrderSeed,
}: {
  readonly participantOrder: readonly ValueId[]
  readonly sourceRoundIndex: number
  readonly orientation: PairOrientationContext
  readonly cycleIndex: number
  readonly matchOrderSeed: string
}) {
  const circleParticipants: readonly CircleParticipant[] =
    participantOrder.length % 2 === 0
      ? participantOrder
      : [...participantOrder, internalBye]
  const rotatedParticipants = rotateCircleParticipants(
    circleParticipants,
    sourceRoundIndex,
  )
  const pairs: ValuePair[] = []

  for (let index = 0; index < rotatedParticipants.length / 2; index += 1) {
    const first = rotatedParticipants[index]
    const second = rotatedParticipants[rotatedParticipants.length - 1 - index]

    if (isActiveValue(first) && isActiveValue(second)) {
      pairs.push(orientValuePair(first, second, orientation, cycleIndex))
    }
  }

  return shuffleDeterministically(pairs, matchOrderSeed)
}

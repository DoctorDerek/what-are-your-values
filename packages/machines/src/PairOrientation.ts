import type { ValueId, ValuePair } from "@game/data/src/Value"

export type PairOrientationContext = {
  readonly activeValueCount: number
  readonly orientationIndexes: ReadonlyMap<ValueId, number>
}

export function createPairOrientationContext(valueIds: readonly ValueId[]) {
  return Object.freeze({
    activeValueCount: valueIds.length,
    orientationIndexes: new Map(
      valueIds.map((valueId, index) => [valueId, index]),
    ),
  }) satisfies PairOrientationContext
}

export function orientValuePair(
  first: ValueId,
  second: ValueId,
  context: PairOrientationContext,
  cycleIndex: number,
): ValuePair {
  const firstIndex = context.orientationIndexes.get(first)
  const secondIndex = context.orientationIndexes.get(second)

  if (firstIndex === undefined || secondIndex === undefined) {
    throw new Error("Scheduled pair contains an unknown active value")
  }

  const orientationSize =
    context.activeValueCount % 2 === 0
      ? context.activeValueCount + 1
      : context.activeValueCount
  const forwardDistance =
    (secondIndex - firstIndex + orientationSize) % orientationSize
  const firstLeads = forwardDistance <= (orientationSize - 1) / 2
  const invertCycle =
    context.activeValueCount % 2 === 0 && cycleIndex % 2 === 1

  return Object.freeze(
    firstLeads !== invertCycle ? [first, second] : [second, first],
  ) as ValuePair
}

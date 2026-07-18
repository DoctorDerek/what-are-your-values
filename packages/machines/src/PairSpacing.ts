import type { ValuePair } from "@game/data/src/Value"

export function pairsShareValue(first: ValuePair, second: ValuePair) {
  return (
    first[0] === second[0] ||
    first[0] === second[1] ||
    first[1] === second[0] ||
    first[1] === second[1]
  )
}

export function avoidImmediateBoundaryRepeat(
  pairs: readonly ValuePair[],
  previousRoundLastPair: ValuePair,
) {
  if (!pairsShareValue(pairs[0], previousRoundLastPair)) {
    return pairs
  }

  const replacementIndex = pairs.findIndex(
    (pair, index) =>
      index > 0 &&
      index < pairs.length - 1 &&
      !pairsShareValue(pair, previousRoundLastPair),
  )

  if (replacementIndex === -1) {
    throw new Error(
      "Active Deck cannot avoid an immediate round-boundary repeat",
    )
  }

  const reorderedPairs = [...pairs]
  const firstPair = reorderedPairs[0]
  reorderedPairs[0] = reorderedPairs[replacementIndex]
  reorderedPairs[replacementIndex] = firstPair
  return reorderedPairs
}

export function preserveBoundarySpacingWhenPossible(
  pairs: readonly ValuePair[],
  previousPair: ValuePair,
) {
  if (!pairsShareValue(pairs[0], previousPair)) {
    return pairs
  }

  const replacementIndex = pairs.findIndex(
    (pair, index) =>
      index > 0 &&
      index < pairs.length - 1 &&
      !pairsShareValue(pair, previousPair),
  )

  if (replacementIndex === -1) {
    return pairs
  }

  const reorderedPairs = [...pairs]
  const firstPair = reorderedPairs[0]
  reorderedPairs[0] = reorderedPairs[replacementIndex]
  reorderedPairs[replacementIndex] = firstPair
  return reorderedPairs
}

export const MAX_SUPPORTED_TOTAL_XP = Math.floor(
  (Number.MAX_SAFE_INTEGER - 1) / 8,
)

function validateTotalXp(totalXp: number) {
  if (
    !Number.isSafeInteger(totalXp) ||
    totalXp < 0 ||
    totalXp > MAX_SUPPORTED_TOTAL_XP
  ) {
    throw new Error(`Unsupported total XP: ${totalXp}`)
  }
}

export function getLevelFromXP(totalXp: number) {
  validateTotalXp(totalXp)

  if (totalXp === 0) return 1
  return Math.floor((1 + Math.sqrt(1 + 8 * totalXp)) / 2)
}

export function calculateCycleSnapshotXpPayout(
  opponentLevelAtCycleStart: number,
) {
  if (
    !Number.isSafeInteger(opponentLevelAtCycleStart) ||
    opponentLevelAtCycleStart < 1
  ) {
    throw new Error(
      `Invalid cycle-snapshot opponent level: ${opponentLevelAtCycleStart}`,
    )
  }

  return Math.min(opponentLevelAtCycleStart, 100)
}

export function calculateXPPayout(loserTotalXP: number) {
  const loserLevel = getLevelFromXP(loserTotalXP)
  return calculateCycleSnapshotXpPayout(loserLevel)
}

export const XP_QUANTUM = 4
export const MAX_PAYOUT_TIER = 100
export const MAX_BATTLE_XP = XP_QUANTUM * MAX_PAYOUT_TIER
export const MAX_SUPPORTED_TOTAL_XP =
  Math.floor((Number.MAX_SAFE_INTEGER - 20) / (11 * XP_QUANTUM)) * XP_QUANTUM

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
  return 1 + Math.floor((11 * totalXp) / 20)
}

const MAX_SUPPORTED_LEVEL = getLevelFromXP(MAX_SUPPORTED_TOTAL_XP)

function validateLevel(level: number) {
  if (
    !Number.isSafeInteger(level) ||
    level < 1 ||
    level > MAX_SUPPORTED_LEVEL
  ) {
    throw new Error(`Unsupported Level: ${level}`)
  }
}

export function getMinimumReachableXpForLevel(level: number) {
  validateLevel(level)
  return XP_QUANTUM * Math.ceil((5 * (level - 1)) / 11)
}

export function getLevelProgressFromXP(totalXp: number) {
  const level = getLevelFromXP(totalXp)
  const levelStartingTotalXp = Math.ceil((20 * (level - 1)) / 11)
  const nextLevelStartingTotalXp = Math.ceil((20 * level) / 11)

  return Object.freeze({
    level,
    earnedXpTowardNextLevel: totalXp - levelStartingTotalXp,
    requiredXpForNextLevel: nextLevelStartingTotalXp - levelStartingTotalXp,
  } as const)
}

export function getPayoutTierFromXP(totalXp: number) {
  validateTotalXp(totalXp)
  return Math.floor((1 + Math.sqrt(1 + 2 * totalXp)) / 2)
}

export function calculateCycleSnapshotXpPayout(
  opponentPayoutTierAtCycleStart: number,
) {
  if (
    !Number.isSafeInteger(opponentPayoutTierAtCycleStart) ||
    opponentPayoutTierAtCycleStart < 1
  ) {
    throw new Error(
      `Invalid cycle-snapshot opponent payout tier: ${opponentPayoutTierAtCycleStart}`,
    )
  }

  return XP_QUANTUM * Math.min(opponentPayoutTierAtCycleStart, MAX_PAYOUT_TIER)
}

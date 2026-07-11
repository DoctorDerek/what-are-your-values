export function getLevelFromXP(totalXP: number) {
  if (totalXP <= 0) return 1
  return Math.floor((1 + Math.sqrt(1 + 8 * totalXP)) / 2)
}

export function calculateXPPayout(loserTotalXP: number) {
  const loserLevel = getLevelFromXP(loserTotalXP)
  return Math.min(Math.max(loserLevel, 1), 100)
}

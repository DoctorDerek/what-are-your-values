import { SEETHING_SWARM_BATTLE_TILE_SIZE } from "@game/data/src/SeethingSwarmAnimalPresentation"

export const SEETHING_SWARM_BATTLE_APPROACH_DURATION_MS = 160

export type SeethingSwarmBattleExchangeCue =
  "introduction" | "attention" | "rest" | "approach" | "strike" | "impact"

export type SeethingSwarmBattlePoint = Readonly<{ x: number; y: number }>

export function resolveSeethingSwarmPlaceholderRole(
  cue: SeethingSwarmBattleExchangeCue,
  isWinner: boolean,
) {
  if (cue === "strike" && isWinner) return "attack"
  if (cue === "impact") return isWinner ? "flourish" : "reaction"
  return "rest"
}

export function createSeethingSwarmBattleTravel({
  attacker,
  defender,
}: {
  readonly attacker: SeethingSwarmBattlePoint
  readonly defender: SeethingSwarmBattlePoint
}): SeethingSwarmBattlePoint {
  const distanceX = defender.x - attacker.x
  const distanceY = defender.y - attacker.y
  const distance = Math.hypot(distanceX, distanceY)
  const contactDistance = SEETHING_SWARM_BATTLE_TILE_SIZE / 2
  const travelFraction =
    distance > contactDistance ? 1 - contactDistance / distance : 0

  return Object.freeze({
    x: Math.round(distanceX * travelFraction),
    y: Math.round(distanceY * travelFraction),
  })
}

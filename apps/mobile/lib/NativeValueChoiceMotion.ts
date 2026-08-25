export type NativeValueChoicePosition = "first" | "second"

export function createNativeValueChoiceMotion({
  position,
  isWinner,
  isDefeated,
  shouldReduceMotion,
}: {
  readonly position: NativeValueChoicePosition
  readonly isWinner: boolean
  readonly isDefeated: boolean
  readonly shouldReduceMotion: boolean
}) {
  const defeatedTranslateY = position === "first" ? -24 : 24

  return Object.freeze({
    durationMilliseconds: shouldReduceMotion ? 0 : 260,
    opacity: isDefeated ? 0.35 : 1,
    scale: shouldReduceMotion ? 1 : isWinner ? 1.04 : isDefeated ? 0.92 : 1,
    translateY: shouldReduceMotion || !isDefeated ? 0 : defeatedTranslateY,
  } as const)
}

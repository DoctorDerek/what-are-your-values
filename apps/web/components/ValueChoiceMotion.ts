export function createValueChoiceMotion({
  isFirst,
  isWinner,
  isDefeated,
  isAnimating,
  shouldReduceMotion = false,
}: {
  isFirst: boolean
  isWinner: boolean
  isDefeated: boolean
  isAnimating: boolean
  shouldReduceMotion?: boolean
}) {
  if (shouldReduceMotion) {
    return Object.freeze({
      initial: false as const,
      animate: Object.freeze({
        x: 0,
        opacity: isDefeated ? 0.3 : 1,
        scale: 1,
        filter: isDefeated ? "grayscale(100%)" : "grayscale(0%)",
        y: 0,
      } as const),
      exit: Object.freeze({ opacity: 0, scale: 1 } as const),
      transition: Object.freeze({ duration: 0 } as const),
    } as const)
  }

  return Object.freeze({
    initial: Object.freeze({
      x: isFirst ? "-100%" : "100%",
      opacity: 0,
    } as const),
    animate: Object.freeze({
      x: 0,
      opacity: isDefeated ? 0.3 : 1,
      scale: isWinner ? 1.05 : isAnimating ? 0.9 : 1,
      filter: isDefeated ? "grayscale(100%)" : "grayscale(0%)",
      y: isDefeated ? (isFirst ? -100 : 100) : 0,
    } as const),
    exit: Object.freeze({ opacity: 0, scale: 0.8 } as const),
    transition: Object.freeze({
      type: "spring",
      stiffness: 300,
      damping: 25,
    } as const),
  } as const)
}

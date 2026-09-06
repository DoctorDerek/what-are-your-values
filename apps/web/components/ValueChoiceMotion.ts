export function createValueChoiceMotion({
  shouldReduceMotion = false,
}: {
  shouldReduceMotion?: boolean
}) {
  return Object.freeze({
    initial: shouldReduceMotion ? false : Object.freeze({ opacity: 0 }),
    animate: Object.freeze({ opacity: 1 }),
    exit: Object.freeze({ opacity: 0 }),
    transition: Object.freeze({ duration: shouldReduceMotion ? 0 : 0.16 }),
  } as const)
}

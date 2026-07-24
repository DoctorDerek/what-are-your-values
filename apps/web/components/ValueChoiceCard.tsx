"use client"

import {
  getValueDisplayDefinition,
  getValueDisplayName,
  type ActiveValueDefinition,
  type ValueId,
} from "@game/data/src/Value"
import { motion, useReducedMotion } from "motion/react"
import { forwardRef, useId } from "react"
import { createValueChoiceMotion } from "@/components/ValueChoiceMotion"

export type ValueChoicePosition = "first" | "second"

type ValueChoiceCardProps = {
  position: ValueChoicePosition
  value: ActiveValueDefinition
  level: number
  focusedId: ValueId | null
  winnerId: ValueId | null
  isEnabled: boolean
  isAnimating: boolean
  onActivate: (valueId: ValueId) => void
  onFocus: (valueId: ValueId) => void
  onAnimationComplete: () => void
}

export const ValueChoiceCard = forwardRef<
  HTMLButtonElement,
  ValueChoiceCardProps
>(function ValueChoiceCard(
  {
    position,
    value,
    level,
    focusedId,
    winnerId,
    isEnabled,
    isAnimating,
    onActivate,
    onFocus,
    onAnimationComplete,
  },
  ref,
) {
  const isFirst = position === "first"
  const displayName = getValueDisplayName(value)
  const isWinner = isAnimating && winnerId === value.id
  const isDefeated = isAnimating && winnerId !== value.id
  const positionClasses = isFirst
    ? "bg-mapache-vivid-primary-cyan border-b-8 border-black lg:border-r-8 lg:border-b-0"
    : "bg-mapache-vivid-primary-raspberry"
  const indicatorClasses = isFirst ? "top-8 left-8" : "top-8 right-8"
  const indicator = isFirst ? "[1 / A]" : "[2 / D]"
  const accessibleDefinitionId = useId()
  const shouldReduceMotion = useReducedMotion() === true
  const valueChoiceMotion = createValueChoiceMotion({
    isFirst,
    isWinner,
    isDefeated,
    isAnimating,
    shouldReduceMotion,
  })

  return (
    <motion.div
      layout
      initial={valueChoiceMotion.initial}
      animate={valueChoiceMotion.animate}
      exit={valueChoiceMotion.exit}
      transition={valueChoiceMotion.transition}
      onAnimationComplete={onAnimationComplete}
      className={`${positionClasses} relative flex min-h-0 min-w-0 flex-1 touch-pan-x touch-pan-y flex-col overflow-x-auto overflow-y-auto overscroll-contain`}
    >
      <button
        ref={ref}
        type="button"
        aria-label={`Choose ${displayName}`}
        aria-describedby={accessibleDefinitionId}
        disabled={!isEnabled}
        onClick={() => onActivate(value.id)}
        onFocus={() => onFocus(value.id)}
        className={`relative flex min-h-[50%] w-full min-w-0 flex-1 cursor-pointer flex-col items-center px-4 py-20 hover:brightness-110 focus-visible:ring-8 focus-visible:ring-white focus-visible:ring-inset disabled:cursor-default disabled:hover:brightness-100 sm:px-8 sm:py-24 lg:py-12 ${focusedId === value.id ? "ring-8 ring-white ring-inset" : ""}`}
      >
        <span
          className={`${indicatorClasses} absolute text-3xl font-black text-black/40 uppercase drop-shadow-[2px_2px_0px_rgba(255,255,255,0.2)] lg:text-5xl`}
        >
          {indicator}
        </span>
        <div className="my-auto w-full max-w-full min-w-0 text-center">
          <span className="mb-6 inline-block max-w-full border-4 border-black bg-white px-4 py-2 text-[clamp(1.25rem,4vw,2.25rem)] font-black [overflow-wrap:anywhere] break-words text-black uppercase shadow-[6px_6px_0px_0px_#000000] sm:mb-10 sm:px-8 sm:py-3">
            LVL {level}
          </span>
          <h2 className="mx-auto w-full max-w-4xl min-w-0 text-[clamp(1.75rem,6vw,6rem)] leading-snug font-black [overflow-wrap:anywhere] break-words text-white uppercase drop-shadow-[6px_6px_0px_#000000] sm:text-[clamp(2rem,5vw,4.25rem)] lg:text-[clamp(2.5rem,4vw,4.75rem)]">
            {displayName}
          </h2>
          <p
            id={accessibleDefinitionId}
            className="mx-auto mt-8 max-w-2xl overflow-x-auto border-2 border-white/20 bg-black/40 p-5 text-[clamp(1.25rem,3vw,1.875rem)] leading-relaxed font-bold [overflow-wrap:anywhere] break-words whitespace-pre-wrap text-white drop-shadow-[2px_2px_0px_#000000] sm:p-6"
          >
            “{getValueDisplayDefinition(value)}”
          </p>
        </div>
      </button>
    </motion.div>
  )
})

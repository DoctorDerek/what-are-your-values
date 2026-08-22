"use client"

import {
  getValueDisplayDefinition,
  getValueDisplayName,
  type ActiveValueDefinition,
  type ValueId,
} from "@game/data/src/Value"
import { motion } from "motion/react"
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
  controlHint: string | null
  shouldReduceMotion: boolean
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
    controlHint,
    shouldReduceMotion,
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
    ? "bg-mapache-vivid-primary-cyan border-b-8 border-black xl:border-r-8 xl:border-b-0"
    : "bg-mapache-vivid-primary-raspberry"
  const reservedControlHint = isFirst ? "[1 / A]" : "[2 / D]"
  const accessibleDefinitionId = useId()
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
      className={`${positionClasses} relative flex min-h-0 min-w-0 flex-1 touch-pan-x touch-pan-y flex-col overflow-x-hidden overflow-y-auto overscroll-contain`}
    >
      <button
        ref={ref}
        type="button"
        aria-label={`Choose ${displayName}`}
        aria-describedby={accessibleDefinitionId}
        disabled={!isEnabled}
        onClick={() => onActivate(value.id)}
        onFocus={() => onFocus(value.id)}
        className={`relative flex min-h-[50%] w-full min-w-0 flex-1 cursor-pointer flex-col items-center px-3 py-4 hover:brightness-110 focus-visible:ring-8 focus-visible:ring-white focus-visible:ring-inset disabled:cursor-default disabled:hover:brightness-100 xl:px-8 xl:py-8 ${focusedId === value.id ? "ring-8 ring-white ring-inset" : ""}`}
      >
        <div className="my-auto w-full max-w-full min-w-0 text-center">
          <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 xl:gap-5">
            <span
              aria-hidden="true"
              className={`w-16 justify-self-start text-center text-sm font-black whitespace-nowrap text-black/50 uppercase drop-shadow-[1px_1px_0px_rgba(255,255,255,0.25)] xl:w-28 xl:text-2xl ${controlHint ? "" : "invisible"}`}
            >
              {controlHint ?? reservedControlHint}
            </span>
            <h2 className="mx-auto w-full max-w-4xl min-w-0 text-[clamp(1.25rem,5vw,2.5rem)] leading-tight font-black [overflow-wrap:anywhere] break-words text-white uppercase drop-shadow-[4px_4px_0px_#000000] xl:text-[clamp(2.5rem,4vw,4.75rem)] xl:drop-shadow-[6px_6px_0px_#000000]">
              {displayName}
            </h2>
            <span className="inline-block border-2 border-black bg-white px-2 py-1 text-sm font-black whitespace-nowrap text-black uppercase shadow-[3px_3px_0px_0px_#000000] xl:border-4 xl:px-4 xl:py-2 xl:text-2xl xl:shadow-[6px_6px_0px_0px_#000000]">
              LVL {level}
            </span>
          </div>
          <p
            id={accessibleDefinitionId}
            className="mx-auto mt-3 max-w-2xl border-2 border-white/20 bg-black/40 p-3 text-[clamp(1rem,2.8vw,1.5rem)] leading-snug font-bold [overflow-wrap:anywhere] break-words whitespace-pre-wrap text-white drop-shadow-[2px_2px_0px_#000000] xl:mt-6 xl:p-6 xl:text-[clamp(1.25rem,2vw,1.875rem)] xl:leading-relaxed"
          >
            “{getValueDisplayDefinition(value)}”
          </p>
        </div>
      </button>
    </motion.div>
  )
})

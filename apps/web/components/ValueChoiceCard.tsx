"use client"

import {
  getValueDisplayDefinition,
  getValueDisplayName,
  type ActiveValueDefinition,
  type ValueId,
} from "@game/data/src/Value"
import { motion } from "motion/react"
import { forwardRef } from "react"

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

  return (
    <motion.button
      ref={ref}
      type="button"
      aria-label={`Choose ${displayName}`}
      disabled={!isEnabled}
      layout
      initial={{ x: isFirst ? "-100%" : "100%", opacity: 0 }}
      animate={{
        x: 0,
        opacity: isDefeated ? 0.3 : 1,
        scale: isWinner ? 1.05 : isAnimating ? 0.9 : 1,
        filter: isDefeated ? "grayscale(100%)" : "grayscale(0%)",
        y: isDefeated ? (isFirst ? -100 : 100) : 0,
      }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onAnimationComplete={onAnimationComplete}
      onClick={() => onActivate(value.id)}
      onFocus={() => onFocus(value.id)}
      className={`${positionClasses} relative flex min-h-0 min-w-0 flex-1 cursor-pointer touch-pan-y flex-col items-center overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-20 hover:brightness-110 focus-visible:ring-8 focus-visible:ring-white focus-visible:ring-inset disabled:cursor-default disabled:hover:brightness-100 sm:px-8 sm:py-24 lg:py-12 ${focusedId === value.id ? "ring-8 ring-white ring-inset" : ""}`}
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
        <h2 className="mx-auto mb-6 w-full max-w-4xl min-w-0 text-[clamp(2.25rem,8vw,8rem)] leading-none font-black [overflow-wrap:anywhere] break-words whitespace-normal text-white uppercase drop-shadow-[6px_6px_0px_#000000] sm:mb-8">
          {displayName}
        </h2>
        <p className="mx-auto w-full max-w-2xl min-w-0 border-2 border-white/20 bg-black/40 p-4 text-[clamp(1.125rem,3vw,1.875rem)] font-bold [overflow-wrap:anywhere] break-words whitespace-normal text-white drop-shadow-[2px_2px_0px_#000000] sm:p-6">
          &ldquo;{getValueDisplayDefinition(value)}&rdquo;
        </p>
      </div>
    </motion.button>
  )
})

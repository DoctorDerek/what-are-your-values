"use client"

import {
  getValueDisplayDefinition,
  getValueDisplayName,
  type ActiveValueDefinition,
  type ValueId,
} from "@game/data/src/Value"
import { motion } from "motion/react"

export type ValueChoicePosition = "first" | "second"

export function ValueChoiceCard({
  position,
  value,
  level,
  focusedId,
  winnerId,
  isAnimating,
  onActivate,
  onAnimationComplete,
}: {
  position: ValueChoicePosition
  value: ActiveValueDefinition
  level: number
  focusedId: ValueId | null
  winnerId: ValueId | null
  isAnimating: boolean
  onActivate: (valueId: ValueId) => void
  onAnimationComplete: () => void
}) {
  const isFirst = position === "first"
  const isWinner = isAnimating && winnerId === value.id
  const isDefeated = isAnimating && winnerId !== value.id
  const positionClasses = isFirst
    ? "bg-mapache-vivid-primary-cyan border-b-8 border-black lg:border-r-8 lg:border-b-0"
    : "bg-mapache-vivid-primary-raspberry"
  const indicatorClasses = isFirst ? "top-8 left-8" : "top-8 right-8"
  const indicator = isFirst ? "[1 / A]" : "[2 / D]"

  return (
    <motion.div
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
      className={`${positionClasses} flex flex-1 cursor-pointer flex-col items-center justify-center p-8 hover:brightness-110 ${focusedId === value.id ? "ring-8 ring-white ring-inset" : ""}`}
    >
      <span
        className={`${indicatorClasses} absolute text-3xl font-black text-black/40 uppercase drop-shadow-[2px_2px_0px_rgba(255,255,255,0.2)] lg:text-5xl`}
      >
        {indicator}
      </span>
      <div className="text-center">
        <span className="mb-10 inline-block border-4 border-black bg-white px-8 py-3 text-4xl font-black text-black uppercase shadow-[6px_6px_0px_0px_#000000]">
          LVL {level}
        </span>
        <h2 className="mb-8 max-w-4xl text-6xl leading-none font-black tracking-tighter text-white uppercase drop-shadow-[6px_6px_0px_#000000] lg:text-9xl">
          {getValueDisplayName(value)}
        </h2>
        <p className="mx-auto max-w-2xl border-2 border-white/20 bg-black/40 p-6 text-3xl font-bold text-white drop-shadow-[2px_2px_0px_#000000]">
          &ldquo;{getValueDisplayDefinition(value)}&rdquo;
        </p>
      </div>
    </motion.div>
  )
}

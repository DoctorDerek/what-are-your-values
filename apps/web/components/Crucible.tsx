"use client"

import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import {
  getValueDisplayDefinition,
  getValueDisplayName,
  type ValueId,
} from "@game/data/src/Value"
import type { ValueProgressById } from "@game/data/src/ValueProgress"
import {
  combatMachine,
  type PresentedBattle,
} from "@game/machines/src/CombatMachine"
import type { SchedulerRestorePoint } from "@game/machines/src/PairScheduler"
import { getLevelFromXP } from "@game/utils/src/LevelMath"
import { useMachine } from "@xstate/react"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect } from "react"

export default function Crucible({
  activeDeck,
  battle,
  progressById,
  onExit,
  onWinnerSelected,
}: {
  activeDeck: ActiveDeck
  battle: PresentedBattle
  progressById: ValueProgressById
  onExit: () => void
  onWinnerSelected: (
    winnerId: ValueId,
    expectedScheduler: SchedulerRestorePoint,
  ) => void
}) {
  const [state, send] = useMachine(combatMachine, {
    input: { onWinnerSelected },
  })

  useEffect(() => {
    send({ type: "BATTLE.PROJECTED", battle })
  }, [battle, send])

  const handleSelect = useCallback(
    (winnerId: ValueId) => {
      if (!state.matches("AwaitingInput")) return
      send({ type: "VALUE.WINNER_SELECTED", valueId: winnerId })
    },
    [state, send],
  )

  const focusedId = state.context.focusedId
  const currentPair = state.context.currentBattle?.pair ?? null
  const isAwaiting = state.matches("AwaitingInput")
  const isAnimating = state.matches("AnimatingResult")
  const handleAnimationComplete = useCallback(() => {
    if (isAnimating) {
      send({ type: "ANIMATION.RESULT_FINISHED" })
    }
  }, [isAnimating, send])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isAwaiting || !currentPair) return

      if (e.key === "1" || e.key.toLowerCase() === "a") {
        handleSelect(currentPair[0])
      } else if (e.key === "2" || e.key.toLowerCase() === "d") {
        handleSelect(currentPair[1])
      } else if (e.key === "Escape") {
        onExit()
      } else if (e.key === "Enter" || e.key === " ") {
        if (focusedId) {
          handleSelect(focusedId)
        }
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        send({ type: "VALUE.FOCUS_REQUESTED", valueId: currentPair[0] })
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        send({ type: "VALUE.FOCUS_REQUESTED", valueId: currentPair[1] })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isAwaiting, currentPair, focusedId, send, onExit, handleSelect])

  const handleCardClick = (clickedId: ValueId) => {
    if (!isAwaiting) return

    if (focusedId === clickedId) {
      handleSelect(clickedId)
    } else {
      send({ type: "VALUE.FOCUS_REQUESTED", valueId: clickedId })
    }
  }

  if (!currentPair) {
    return (
      <div className="bg-mapache-vivid-dark noise-bg flex h-[100dvh] w-[100dvw] items-center justify-center text-6xl font-black text-white uppercase">
        Forging Matrix...
      </div>
    )
  }

  const [idA, idB] = currentPair
  const valA = activeDeck.values.find(({ id }) => id === idA)
  const valB = activeDeck.values.find(({ id }) => id === idB)
  const progressA = progressById.get(idA)
  const progressB = progressById.get(idB)
  if (!valA || !valB || !progressA || !progressB) {
    throw new Error("Projected battle is missing Active Deck data")
  }
  const levelA = getLevelFromXP(progressA.totalXp)
  const levelB = getLevelFromXP(progressB.totalXp)
  const winnerId = state.context.winnerId

  return (
    <div className="noise-bg bg-mapache-vivid-dark relative flex h-[100dvh] w-[100dvw] touch-none flex-col overflow-hidden lg:flex-row">
      <button
        onClick={onExit}
        className="bg-mapache-vivid-secondary-red absolute top-6 left-1/2 z-50 -translate-x-1/2 cursor-pointer border-4 border-black px-10 py-4 text-3xl font-black text-white uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#000000] active:translate-y-[2px] active:shadow-none"
      >
        Stop [ESC]
      </button>

      {/*
       * ONE-TIME EXCEPTION TO NO CODE COMMENT RULE:
       * Animation (React Key Prop) Note: To ensure that Motion or other animations fire correctly —
       * and that the cards have truly unique key props — the cards use the React key props
       * key={`Card A: ${idA} vs. ${idB}`} and key={`Card B: ${idB} vs. ${idA}`}; this prevents a
       * fixed regression (bug) where animations wouldn’t fire if the same value appeared twice
       * on one side (“Card A” or “Card B”), which created an edge case of an extremely confusing UX
       * because the repeat card didn’t animate correctly.
       */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={`Card A: ${idA} vs. ${idB}`}
          layout
          initial={{ x: "-100%", opacity: 0 }}
          animate={{
            x: 0,
            opacity: isAnimating && winnerId === idB ? 0.3 : 1,
            scale:
              isAnimating && winnerId === idA ? 1.05 : isAnimating ? 0.9 : 1,
            filter:
              isAnimating && winnerId === idB
                ? "grayscale(100%)"
                : "grayscale(0%)",
            y: isAnimating && winnerId === idB ? -100 : 0,
          }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onAnimationComplete={handleAnimationComplete}
          onClick={() => handleCardClick(idA)}
          className={`bg-mapache-vivid-primary-cyan flex flex-1 cursor-pointer flex-col items-center justify-center border-b-8 border-black p-8 hover:brightness-110 lg:border-r-8 lg:border-b-0 ${focusedId === idA ? "ring-8 ring-white ring-inset" : ""}`}
        >
          <span className="absolute top-8 left-8 text-3xl font-black text-black/40 uppercase drop-shadow-[2px_2px_0px_rgba(255,255,255,0.2)] lg:text-5xl">
            [1 / A]
          </span>
          <div className="text-center">
            <span className="mb-10 inline-block border-4 border-black bg-white px-8 py-3 text-4xl font-black text-black uppercase shadow-[6px_6px_0px_0px_#000000]">
              LVL {levelA}
            </span>
            <h2 className="mb-8 max-w-4xl text-6xl leading-none font-black tracking-tighter text-white uppercase drop-shadow-[6px_6px_0px_#000000] lg:text-9xl">
              {getValueDisplayName(valA)}
            </h2>
            <p className="mx-auto max-w-2xl border-2 border-white/20 bg-black/40 p-6 text-3xl font-bold text-white drop-shadow-[2px_2px_0px_#000000]">
              &ldquo;{getValueDisplayDefinition(valA)}&rdquo;
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="popLayout">
        <motion.div
          key={`Card B: ${idB} vs. ${idA}`}
          layout
          initial={{ x: "100%", opacity: 0 }}
          animate={{
            x: 0,
            opacity: isAnimating && winnerId === idA ? 0.3 : 1,
            scale:
              isAnimating && winnerId === idB ? 1.05 : isAnimating ? 0.9 : 1,
            filter:
              isAnimating && winnerId === idA
                ? "grayscale(100%)"
                : "grayscale(0%)",
            y: isAnimating && winnerId === idA ? 100 : 0,
          }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onAnimationComplete={handleAnimationComplete}
          onClick={() => handleCardClick(idB)}
          className={`bg-mapache-vivid-primary-raspberry flex flex-1 cursor-pointer flex-col items-center justify-center p-8 hover:brightness-110 ${focusedId === idB ? "ring-8 ring-white ring-inset" : ""}`}
        >
          <span className="absolute top-8 right-8 text-3xl font-black text-black/40 uppercase drop-shadow-[2px_2px_0px_rgba(255,255,255,0.2)] lg:text-5xl">
            [2 / D]
          </span>
          <div className="text-center">
            <span className="mb-10 inline-block border-4 border-black bg-white px-8 py-3 text-4xl font-black text-black uppercase shadow-[6px_6px_0px_0px_#000000]">
              LVL {levelB}
            </span>
            <h2 className="mb-8 max-w-4xl text-6xl leading-none font-black tracking-tighter text-white uppercase drop-shadow-[6px_6px_0px_#000000] lg:text-9xl">
              {getValueDisplayName(valB)}
            </h2>
            <p className="mx-auto max-w-2xl border-2 border-white/20 bg-black/40 p-6 text-3xl font-bold text-white drop-shadow-[2px_2px_0px_#000000]">
              &ldquo;{getValueDisplayDefinition(valB)}&rdquo;
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

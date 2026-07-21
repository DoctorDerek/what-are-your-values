"use client"

import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import type { ValueProgressById } from "@game/data/src/ValueProgress"
import {
  combatMachine,
  type PresentedBattle,
} from "@game/machines/src/CombatMachine"
import type { SchedulerRestorePoint } from "@game/machines/src/PairScheduler"
import { getLevelFromXP } from "@game/utils/src/LevelMath"
import { useMachine } from "@xstate/react"
import { AnimatePresence } from "motion/react"
import { useCallback, useEffect, useRef } from "react"
import { ValueChoiceCard } from "./ValueChoiceCard"

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
  const firstChoiceRef = useRef<HTMLButtonElement>(null)
  const secondChoiceRef = useRef<HTMLButtonElement>(null)

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
        e.preventDefault()
        handleSelect(currentPair[0])
      } else if (e.key === "2" || e.key.toLowerCase() === "d") {
        e.preventDefault()
        handleSelect(currentPair[1])
      } else if (e.key === "Escape") {
        onExit()
      } else if (e.key === "Enter" || e.key === " ") {
        if (focusedId) {
          e.preventDefault()
          handleSelect(focusedId)
        }
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault()
        send({ type: "VALUE.FOCUS_REQUESTED", valueId: currentPair[0] })
        firstChoiceRef.current?.focus()
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault()
        send({ type: "VALUE.FOCUS_REQUESTED", valueId: currentPair[1] })
        secondChoiceRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isAwaiting, currentPair, focusedId, send, onExit, handleSelect])

  const handleCardFocus = useCallback(
    (valueId: ValueId) => {
      if (isAwaiting) {
        send({ type: "VALUE.FOCUS_REQUESTED", valueId })
      }
    },
    [isAwaiting, send],
  )

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
    <main
      aria-label="Value battle"
      className="noise-bg bg-mapache-vivid-dark relative flex h-[100dvh] w-[100dvw] touch-manipulation flex-col overflow-hidden lg:flex-row"
    >
      <button
        onClick={onExit}
        className="bg-mapache-vivid-secondary-red absolute top-3 left-1/2 z-50 max-w-[calc(100%-1.5rem)] -translate-x-1/2 cursor-pointer border-4 border-black px-4 py-2 text-xl font-black [overflow-wrap:anywhere] break-words whitespace-normal text-white uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#000000] active:translate-y-[2px] active:shadow-none sm:top-6 sm:px-10 sm:py-4 sm:text-3xl"
      >
        Stop [ESC]
      </button>

      <AnimatePresence mode="popLayout">
        <ValueChoiceCard
          ref={firstChoiceRef}
          key={`Card A: ${idA} vs. ${idB}`}
          position="first"
          value={valA}
          level={levelA}
          focusedId={focusedId}
          winnerId={winnerId}
          isEnabled={isAwaiting}
          isAnimating={isAnimating}
          onActivate={handleSelect}
          onFocus={handleCardFocus}
          onAnimationComplete={handleAnimationComplete}
        />
      </AnimatePresence>

      <AnimatePresence mode="popLayout">
        <ValueChoiceCard
          ref={secondChoiceRef}
          key={`Card B: ${idB} vs. ${idA}`}
          position="second"
          value={valB}
          level={levelB}
          focusedId={focusedId}
          winnerId={winnerId}
          isEnabled={isAwaiting}
          isAnimating={isAnimating}
          onActivate={handleSelect}
          onFocus={handleCardFocus}
          onAnimationComplete={handleAnimationComplete}
        />
      </AnimatePresence>
    </main>
  )
}

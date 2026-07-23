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
import BattleActionBar from "./BattleActionBar"
import { ValueChoiceCard } from "./ValueChoiceCard"

export default function Crucible({
  activeDeck,
  battle,
  progressById,
  canUndo,
  canRedo,
  isPersistencePending,
  onExit,
  onUndo,
  onRedo,
  onWinnerSelected,
}: {
  activeDeck: ActiveDeck
  battle: PresentedBattle
  progressById: ValueProgressById
  canUndo: boolean
  canRedo: boolean
  isPersistencePending: boolean
  onExit: () => void
  onUndo: () => void
  onRedo: () => void
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

  const isInteractive = state.matches("AwaitingInput") && !isPersistencePending

  const handleSelect = useCallback(
    (winnerId: ValueId) => {
      if (!isInteractive) return
      send({ type: "VALUE.WINNER_SELECTED", valueId: winnerId })
    },
    [isInteractive, send],
  )

  const focusedId = state.context.focusedId
  const currentPair = state.context.currentBattle?.pair ?? null
  const isAnimating = state.matches("AnimatingResult")
  const handleAnimationComplete = useCallback(() => {
    if (isAnimating) {
      send({ type: "ANIMATION.RESULT_FINISHED" })
    }
  }, [isAnimating, send])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isInteractive || !currentPair) return

      const normalizedKey = e.key.toLowerCase()
      const isUndoCommand = normalizedKey === "z" && !e.shiftKey
      const isRedoCommand =
        normalizedKey === "y" ||
        (normalizedKey === "z" && e.shiftKey && (e.metaKey || e.ctrlKey))

      if (isUndoCommand && canUndo && !e.repeat) {
        e.preventDefault()
        onUndo()
      } else if (isRedoCommand && canRedo && !e.repeat) {
        e.preventDefault()
        onRedo()
      } else if (e.key === "1" || normalizedKey === "a") {
        e.preventDefault()
        handleSelect(currentPair[0])
      } else if (e.key === "2" || normalizedKey === "d") {
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
  }, [
    isInteractive,
    currentPair,
    focusedId,
    canUndo,
    canRedo,
    send,
    onExit,
    onUndo,
    onRedo,
    handleSelect,
  ])

  const handleCardFocus = useCallback(
    (valueId: ValueId) => {
      if (isInteractive) {
        send({ type: "VALUE.FOCUS_REQUESTED", valueId })
      }
    },
    [isInteractive, send],
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
      aria-busy={isPersistencePending}
      className="noise-bg bg-mapache-vivid-dark relative flex h-[100dvh] w-[100dvw] touch-manipulation flex-col overflow-hidden overscroll-none select-none lg:flex-row"
    >
      <BattleActionBar
        canUndo={isInteractive && canUndo}
        canRedo={isInteractive && canRedo}
        canStop={isInteractive}
        onUndo={onUndo}
        onRedo={onRedo}
        onStop={onExit}
      />

      <AnimatePresence mode="popLayout">
        <ValueChoiceCard
          ref={firstChoiceRef}
          key={`Card A: ${idA} vs. ${idB}`}
          position="first"
          value={valA}
          level={levelA}
          focusedId={focusedId}
          winnerId={winnerId}
          isEnabled={isInteractive}
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
          isEnabled={isInteractive}
          isAnimating={isAnimating}
          onActivate={handleSelect}
          onFocus={handleCardFocus}
          onAnimationComplete={handleAnimationComplete}
        />
      </AnimatePresence>
    </main>
  )
}

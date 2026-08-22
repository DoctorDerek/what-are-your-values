"use client"

import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { ValueId } from "@game/data/src/Value"
import type { ValueProgressById } from "@game/data/src/ValueProgress"
import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import type { BattleSchedulerRestorePoint } from "@game/machines/src/BattleScheduler"
import {
  combatMachine,
  type PresentedBattle,
} from "@game/machines/src/CombatMachine"
import type { ControlHintPreference } from "@game/machines/src/PlayerSettings"
import { getValueChoiceControlHint } from "@game/machines/src/PlayerSettingsPresentation"
import { getLevelFromXP } from "@game/utils/src/LevelMath"
import { useMachine } from "@xstate/react"
import { AnimatePresence } from "motion/react"
import { useCallback, useEffect, useRef } from "react"
import useWebControlHintInputModality from "@/lib/useWebControlHintInputModality"
import AchievementBanner from "./AchievementBanner"
import BattleActionBar from "./BattleActionBar"
import { ValueChoiceCard } from "./ValueChoiceCard"

export default function Crucible({
  activeDeck,
  achievement,
  battle,
  progressById,
  canUndo,
  canRedo,
  controlHintPreference,
  isAchievementAcknowledgementPending,
  isMenuOpen,
  isPersistencePending,
  shouldReduceMotion,
  onAchievementPresented,
  onExit,
  onOpenMenu,
  onUndo,
  onRedo,
  onWinnerSelected,
}: {
  activeDeck: ActiveDeck
  achievement: AchievementPresentation | null
  battle: PresentedBattle
  progressById: ValueProgressById
  canUndo: boolean
  canRedo: boolean
  controlHintPreference: ControlHintPreference
  isAchievementAcknowledgementPending: boolean
  isMenuOpen: boolean
  isPersistencePending: boolean
  shouldReduceMotion: boolean
  onAchievementPresented: (achievementId: AchievementPresentation["id"]) => void
  onExit: () => void
  onOpenMenu: () => void
  onUndo: () => void
  onRedo: () => void
  onWinnerSelected: (
    winnerId: ValueId,
    expectedScheduler: BattleSchedulerRestorePoint,
  ) => void
}) {
  const [state, send] = useMachine(combatMachine, {
    input: { onWinnerSelected },
  })
  const controlHintInputModality = useWebControlHintInputModality()
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
      if (!isInteractive || !currentPair || isMenuOpen) return

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
        e.preventDefault()
        onOpenMenu()
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
    isMenuOpen,
    currentPair,
    focusedId,
    canUndo,
    canRedo,
    send,
    onOpenMenu,
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
  const firstControlHint = getValueChoiceControlHint({
    preference: controlHintPreference,
    inputModality: controlHintInputModality,
    position: "first",
  })
  const secondControlHint = getValueChoiceControlHint({
    preference: controlHintPreference,
    inputModality: controlHintInputModality,
    position: "second",
  })
  const winnerId = state.context.winnerId

  return (
    <main
      aria-label="Value battle"
      aria-busy={isPersistencePending}
      className="noise-bg bg-mapache-vivid-dark relative flex h-[100dvh] w-[100dvw] touch-manipulation flex-col overflow-hidden overscroll-none select-none"
    >
      <div className="pointer-events-none relative z-50 flex shrink-0 flex-col items-center">
        <BattleActionBar
          canOpenMenu={isInteractive}
          canUndo={isInteractive && canUndo}
          canRedo={isInteractive && canRedo}
          canStop={isInteractive}
          onOpenMenu={onOpenMenu}
          onUndo={onUndo}
          onRedo={onRedo}
          onStop={onExit}
        />

        <AchievementBanner
          achievement={achievement}
          isAcknowledgementPending={isAchievementAcknowledgementPending}
          placement="battle"
          shouldReduceMotion={shouldReduceMotion}
          onPresented={onAchievementPresented}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">
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
            controlHint={firstControlHint}
            shouldReduceMotion={shouldReduceMotion}
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
            controlHint={secondControlHint}
            shouldReduceMotion={shouldReduceMotion}
            onActivate={handleSelect}
            onFocus={handleCardFocus}
            onAnimationComplete={handleAnimationComplete}
          />
        </AnimatePresence>
      </div>
    </main>
  )
}

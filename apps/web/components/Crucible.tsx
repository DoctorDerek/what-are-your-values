"use client"

import type { ActiveDeck } from "@game/data/src/ActiveDeck"
import type { SeethingSwarmRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import type { ValueId } from "@game/data/src/Value"
import type { ValueProgressById } from "@game/data/src/ValueProgress"
import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import {
  createPendingBattleAccessibilityAction,
  getBattleAccessibilityAnnouncement,
  type PendingBattleAccessibilityAction,
} from "@game/machines/src/BattleAccessibilityPresentation"
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
import type { StaticImageData } from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import MapacheScreen from "@/components/MapacheScreen"
import useWebControlHintInputModality from "@/lib/useWebControlHintInputModality"
import AchievementBanner from "./AchievementBanner"
import BattleActionBar from "./BattleActionBar"
import SeethingSwarmBattleStage from "./SeethingSwarmBattleStage"
import { ValueChoiceCard } from "./ValueChoiceCard"

type BattleAccessibilityAnnouncement = Readonly<{
  sequence: number
  message: string
}>

export default function Crucible({
  activeDeck,
  achievement,
  battle,
  progressById,
  runtimeClipCatalog,
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
  runtimeClipCatalog: SeethingSwarmRuntimeClipCatalog<StaticImageData>
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
  const pendingAccessibilityActionRef =
    useRef<PendingBattleAccessibilityAction | null>(null)
  const nextAccessibilityAnnouncementSequenceRef = useRef(0)
  const [accessibilityAnnouncement, setAccessibilityAnnouncement] =
    useState<BattleAccessibilityAnnouncement | null>(null)

  useEffect(() => {
    send({ type: "BATTLE.PROJECTED", battle })
  }, [battle, send])

  const isInteractive = state.matches("AwaitingInput") && !isPersistencePending

  const handleSelect = useCallback(
    (winnerId: ValueId) => {
      if (!isInteractive || isMenuOpen || pendingAccessibilityActionRef.current)
        return

      pendingAccessibilityActionRef.current =
        createPendingBattleAccessibilityAction({
          action: { kind: "selection", selectedValueId: winnerId },
          progressById,
        })
      send({ type: "VALUE.WINNER_SELECTED", valueId: winnerId })
    },
    [isInteractive, isMenuOpen, progressById, send],
  )

  const handleUndo = useCallback(() => {
    if (
      !isInteractive ||
      isMenuOpen ||
      !canUndo ||
      pendingAccessibilityActionRef.current
    )
      return

    pendingAccessibilityActionRef.current =
      createPendingBattleAccessibilityAction({
        action: { kind: "undo" },
        progressById,
      })
    onUndo()
  }, [canUndo, isInteractive, isMenuOpen, onUndo, progressById])

  const handleRedo = useCallback(() => {
    if (
      !isInteractive ||
      isMenuOpen ||
      !canRedo ||
      pendingAccessibilityActionRef.current
    )
      return

    pendingAccessibilityActionRef.current =
      createPendingBattleAccessibilityAction({
        action: { kind: "redo" },
        progressById,
      })
    onRedo()
  }, [canRedo, isInteractive, isMenuOpen, onRedo, progressById])

  const focusedId = state.context.focusedId
  const currentBattle = state.context.currentBattle
  const currentPair = currentBattle?.pair ?? null
  const isAnimating = state.matches("AnimatingResult")
  const handleResultAnimationComplete = useCallback(() => {
    if (isAnimating) {
      send({ type: "ANIMATION.RESULT_FINISHED" })
    }
  }, [isAnimating, send])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isInteractive || !currentPair || isMenuOpen)
        return

      const normalizedKey = e.key.toLowerCase()
      const isUndoCommand = normalizedKey === "z" && !e.shiftKey
      const isRedoCommand =
        normalizedKey === "y" ||
        (normalizedKey === "z" && e.shiftKey && (e.metaKey || e.ctrlKey))

      if (isUndoCommand && canUndo && !e.repeat) {
        e.preventDefault()
        handleUndo()
      } else if (isRedoCommand && canRedo && !e.repeat) {
        e.preventDefault()
        handleRedo()
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
    handleUndo,
    handleRedo,
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

  useEffect(() => {
    const pendingAction = pendingAccessibilityActionRef.current
    if (
      !pendingAction ||
      !currentPair ||
      currentBattle !== battle ||
      !isInteractive ||
      isMenuOpen
    )
      return

    const message = getBattleAccessibilityAnnouncement({
      pendingAction,
      activeDeck,
      progressById,
      pair: currentPair,
    })
    if (!message) return

    pendingAccessibilityActionRef.current = null
    nextAccessibilityAnnouncementSequenceRef.current += 1
    setAccessibilityAnnouncement(
      Object.freeze({
        sequence: nextAccessibilityAnnouncementSequenceRef.current,
        message,
      }),
    )
    firstChoiceRef.current?.focus({ preventScroll: true })
  }, [
    activeDeck,
    battle,
    currentBattle,
    currentPair,
    isInteractive,
    isMenuOpen,
    progressById,
  ])

  if (!currentBattle || !currentPair) {
    return (
      <MapacheScreen
        spacing="safe-area-only"
        viewport="fixed"
        className="flex items-center justify-center text-6xl font-black text-white uppercase"
      >
        Forging Matrix...
      </MapacheScreen>
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
  const showKeyboardControlHints =
    controlHintInputModality === "keyboard" && firstControlHint !== null
  const winnerId = state.context.winnerId

  return (
    <MapacheScreen
      aria-label="Value battle"
      aria-busy={isPersistencePending}
      spacing="safe-area-only"
      viewport="fixed"
      className="relative flex touch-manipulation flex-col overscroll-none select-none"
    >
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {accessibilityAnnouncement ? (
          <span key={accessibilityAnnouncement.sequence}>
            {accessibilityAnnouncement.message}
          </span>
        ) : null}
      </p>

      <div className="pointer-events-none relative z-50 flex shrink-0 flex-col items-center">
        <BattleActionBar
          canOpenMenu={isInteractive}
          canUndo={isInteractive && canUndo}
          canRedo={isInteractive && canRedo}
          canStop={isInteractive}
          showKeyboardControlHints={showKeyboardControlHints}
          onOpenMenu={onOpenMenu}
          onUndo={handleUndo}
          onRedo={handleRedo}
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col xl:grid xl:grid-cols-2 xl:grid-rows-[minmax(0,1fr)_auto]">
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
          />
        </AnimatePresence>

        <SeethingSwarmBattleStage
          battle={currentBattle}
          isNextBattleReady={state.context.pendingBattle !== null}
          isPaused={isMenuOpen}
          runtimeClipCatalog={runtimeClipCatalog}
          shouldReduceMotion={shouldReduceMotion}
          winnerId={winnerId}
          onResultAnimationComplete={handleResultAnimationComplete}
        />

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
          />
        </AnimatePresence>
      </div>
    </MapacheScreen>
  )
}

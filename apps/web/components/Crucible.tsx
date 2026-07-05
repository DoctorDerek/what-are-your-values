"use client"

import { LIST_OF_VALUES } from "@what-are-your-values-mapache/data/src/list-of-values"
import { combatMachine } from "@what-are-your-values-mapache/machines/src/combatMachine"
import {
  calculateXPPayout,
  getLevelFromXP,
} from "@what-are-your-values-mapache/utils/src/math"
import { useMachine } from "@xstate/react"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect } from "react"

export default function Crucible({
  valuesXp,
  onExit,
  onBattleCompleted,
}: {
  valuesXp: Record<number, number>
  onExit: () => void
  onBattleCompleted: (w: number, l: number, xp: number) => void
}) {
  const [state, send] = useMachine(combatMachine)

  useEffect(() => {
    const queueStr = window.localStorage.getItem("wayvm_queue")
    const queue = queueStr ? JSON.parse(queueStr) : []
    const valueIds = LIST_OF_VALUES.map((v) => v.id)
    send({ type: "INITIALIZE", queue, valueIds })
  }, [send])

  const handleSelect = (winnerId: number, loserId: number) => {
    if (!state.matches("AwaitingInput")) return
    const loserXp = valuesXp[loserId] || 0
    const payout = calculateXPPayout(loserXp)
    onBattleCompleted(winnerId, loserId, payout)
    send({ type: "SELECT_WINNER", winnerId })
  }

  const focusedId = state.context.focusedId
  const currentPair = state.context.currentPair
  const isAwaiting = state.matches("AwaitingInput")

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isAwaiting || !currentPair) return

      if (e.key === "1" || e.key.toLowerCase() === "a") {
        handleSelect(currentPair[0], currentPair[1])
      } else if (e.key === "2" || e.key.toLowerCase() === "d") {
        handleSelect(currentPair[1], currentPair[0])
      } else if (e.key === "Escape") {
        onExit()
      } else if (e.key === "Enter" || e.key === " ") {
        if (focusedId) {
          const loserId =
            currentPair[0] === focusedId ? currentPair[1] : currentPair[0]
          handleSelect(focusedId, loserId)
        }
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        send({ type: "FOCUS_VALUE", id: currentPair[0] })
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        send({ type: "FOCUS_VALUE", id: currentPair[1] })
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isAwaiting, currentPair, focusedId, valuesXp, send, onExit])

  const handleCardClick = (clickedId: number, opponentId: number) => {
    if (!isAwaiting) return

    if (focusedId === clickedId) {
      handleSelect(clickedId, opponentId)
    } else {
      send({ type: "FOCUS_VALUE", id: clickedId })
    }
  }

  if (!currentPair) {
    return (
      <div className="flex h-[100dvh] w-[100dvw] items-center justify-center bg-mapache-vivid-dark text-6xl font-black uppercase text-white noise-bg">
        Forging Matrix...
      </div>
    )
  }

  const [idA, idB] = currentPair
  const valA = LIST_OF_VALUES.find((v) => v.id === idA)
  const valB = LIST_OF_VALUES.find((v) => v.id === idB)
  const levelA = getLevelFromXP(valuesXp[idA] || 0)
  const levelB = getLevelFromXP(valuesXp[idB] || 0)
  const isAnimating = state.matches("Animating")
  const winnerId = state.context.winnerId

  return (
    <div className="noise-bg relative flex h-[100dvh] w-[100dvw] flex-col overflow-hidden bg-mapache-vivid-dark lg:flex-row touch-none">
      <button
        onClick={onExit}
        className="absolute left-1/2 top-6 z-50 -translate-x-1/2 cursor-pointer border-4 border-black bg-mapache-vivid-secondary-red px-10 py-4 text-3xl font-black uppercase text-white shadow-[6px_6px_0px_0px_#000000] active:translate-y-[2px] active:shadow-none hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#000000]"
      >
        Stop [ESC]
      </button>

      <AnimatePresence mode="popLayout">
        <motion.div
          key={idA}
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
            y: isAnimating && winnerId === idB ? 100 : 0,
          }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={() => handleCardClick(idA, idB)}
          className={`flex flex-1 cursor-pointer flex-col items-center justify-center border-b-8 border-black bg-mapache-vivid-primary-cyan p-8 hover:brightness-110 lg:border-r-8 lg:border-b-0 ${focusedId === idA ? "ring-8 ring-inset ring-white" : ""}`}
        >
          <span className="absolute left-8 top-8 text-3xl font-black uppercase text-black/40 drop-shadow-[2px_2px_0px_rgba(255,255,255,0.2)] lg:text-5xl">
            [1 / A]
          </span>
          <div className="text-center">
            <span className="mb-10 inline-block border-4 border-black bg-white px-8 py-3 text-4xl font-black uppercase text-black shadow-[6px_6px_0px_0px_#000000]">
              LVL {levelA}
            </span>
            <h2 className="mb-8 text-6xl font-black uppercase text-white drop-shadow-[6px_6px_0px_#000000] lg:text-9xl max-w-4xl tracking-tighter leading-none">
              {valA?.value}
            </h2>
            <p className="max-w-2xl mx-auto text-3xl font-bold text-white drop-shadow-[2px_2px_0px_#000000] bg-black/40 p-6 border-2 border-white/20">
              &ldquo;{valA?.definition}&rdquo;
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="popLayout">
        <motion.div
          key={idB}
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
          onClick={() => handleCardClick(idB, idA)}
          className={`flex flex-1 cursor-pointer flex-col items-center justify-center bg-mapache-vivid-primary-raspberry p-8 hover:brightness-110 ${focusedId === idB ? "ring-8 ring-inset ring-white" : ""}`}
        >
          <span className="absolute right-8 top-8 text-3xl font-black uppercase text-black/40 drop-shadow-[2px_2px_0px_rgba(255,255,255,0.2)] lg:text-5xl">
            [2 / D]
          </span>
          <div className="text-center">
            <span className="mb-10 inline-block border-4 border-black bg-white px-8 py-3 text-4xl font-black uppercase text-black shadow-[6px_6px_0px_0px_#000000]">
              LVL {levelB}
            </span>
            <h2 className="mb-8 text-6xl font-black uppercase text-white drop-shadow-[6px_6px_0px_#000000] lg:text-9xl max-w-4xl tracking-tighter leading-none">
              {valB?.value}
            </h2>
            <p className="max-w-2xl mx-auto text-3xl font-bold text-white drop-shadow-[2px_2px_0px_#000000] bg-black/40 p-6 border-2 border-white/20">
              &ldquo;{valB?.definition}&rdquo;
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

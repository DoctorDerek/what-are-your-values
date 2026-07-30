"use client"

import { getAchievementDefinition } from "@game/machines/src/AchievementCatalog"
import type { AchievementUnlock } from "@game/machines/src/AchievementState"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

const ACHIEVEMENT_BANNER_DURATION_SECONDS = 8

function createAchievementBannerMotion(shouldReduceMotion: boolean) {
  return shouldReduceMotion
    ? Object.freeze({
        initial: { opacity: 1 },
        animate: { opacity: [1, 1] },
        exit: { opacity: 0 },
        transition: {
          duration: ACHIEVEMENT_BANNER_DURATION_SECONDS,
        },
      })
    : Object.freeze({
        initial: { opacity: 0, y: 24 },
        animate: {
          opacity: [0, 1, 1],
          y: [24, 0, 0],
        },
        exit: { opacity: 0, y: 24 },
        transition: {
          duration: ACHIEVEMENT_BANNER_DURATION_SECONDS,
          times: [0, 0.08, 1],
          ease: "easeOut",
        },
      })
}

export default function AchievementBanner({
  unlock,
  isPresentationPersistencePending,
  onPresented,
}: {
  unlock: AchievementUnlock | null
  isPresentationPersistencePending: boolean
  onPresented: (achievementId: AchievementUnlock["id"]) => void
}) {
  const shouldReduceMotion = useReducedMotion() === true
  const achievementBannerMotion =
    createAchievementBannerMotion(shouldReduceMotion)

  return (
    <AnimatePresence>
      {unlock ? (
        <motion.aside
          key={unlock.id}
          aria-label="Achievement unlocked"
          initial={achievementBannerMotion.initial}
          animate={achievementBannerMotion.animate}
          exit={achievementBannerMotion.exit}
          transition={achievementBannerMotion.transition}
          onAnimationComplete={() => onPresented(unlock.id)}
          className="pointer-events-none fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-[60] mx-auto max-w-2xl"
        >
          <p role="status" aria-live="polite" className="sr-only">
            Achievement unlocked: {getAchievementDefinition(unlock.id).title}.
          </p>
          <div className="bg-mapache-vivid-primary-yellow text-mapache-vivid-dark pointer-events-auto border-4 border-black p-4 shadow-[8px_8px_0px_0px_#000000] sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase">
                  Achievement Unlocked
                </p>
                <h2 className="mt-1 text-2xl font-black uppercase sm:text-3xl">
                  {getAchievementDefinition(unlock.id).title}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Dismiss achievement"
                disabled={isPresentationPersistencePending}
                onClick={() => onPresented(unlock.id)}
                className="min-h-11 min-w-11 cursor-pointer border-4 border-black bg-white px-3 py-1 text-xl font-black text-black shadow-[4px_4px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-60"
              >
                ×
              </button>
            </div>
            <p className="mt-3 text-lg font-bold">
              {getAchievementDefinition(unlock.id).description}
            </p>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}

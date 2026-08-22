"use client"

import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import { motion } from "motion/react"

const ACHIEVEMENT_BANNER_DURATION_SECONDS = 8

function createAchievementBannerMotion(shouldReduceMotion: boolean) {
  return shouldReduceMotion
    ? Object.freeze({
        initial: { opacity: 1 },
        animate: { opacity: [1, 1] },
        transition: { duration: ACHIEVEMENT_BANNER_DURATION_SECONDS },
      })
    : Object.freeze({
        initial: { opacity: 0, y: 24 },
        animate: { opacity: [0, 1, 1], y: [24, 0, 0] },
        transition: {
          duration: ACHIEVEMENT_BANNER_DURATION_SECONDS,
          times: [0, 0.08, 1],
          ease: "easeOut",
        },
      })
}

export default function AchievementBanner({
  achievement,
  isAcknowledgementPending,
  placement = "screen",
  shouldReduceMotion,
  onPresented,
}: {
  achievement: AchievementPresentation | null
  isAcknowledgementPending: boolean
  placement?: "battle" | "screen"
  shouldReduceMotion: boolean
  onPresented: (achievementId: AchievementPresentation["id"]) => void
}) {
  const achievementBannerMotion =
    createAchievementBannerMotion(shouldReduceMotion)
  const isBattlePlacement = placement === "battle"

  if (!achievement) return null

  return (
    <motion.aside
      key={achievement.id}
      aria-label="Achievement unlocked"
      initial={achievementBannerMotion.initial}
      animate={achievementBannerMotion.animate}
      transition={achievementBannerMotion.transition}
      onAnimationComplete={() => onPresented(achievement.id)}
      className={
        isBattlePlacement
          ? "pointer-events-none relative z-[60] mx-auto w-[calc(100%-1.5rem)] max-w-7xl shrink-0"
          : "pointer-events-none fixed right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-[60] mx-auto max-w-2xl"
      }
    >
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        Achievement unlocked: {achievement.title}.
      </p>
      <div
        className={`bg-mapache-vivid-white text-mapache-vivid-black pointer-events-auto relative overflow-y-auto border-4 border-black p-3 shadow-[8px_8px_0px_0px_#000000] xl:p-5 ${isBattlePlacement ? "max-h-[min(38dvh,12rem)] xl:grid xl:max-h-[min(50dvh,16rem)] xl:grid-cols-2 xl:items-center xl:gap-5" : "max-h-[min(50dvh,16rem)]"}`}
      >
        <div className={`min-w-0 pr-16 ${isBattlePlacement ? "xl:pr-0" : ""}`}>
          <p className="text-sm font-black uppercase">Achievement Unlocked</p>
          <h2 className="mt-1 text-2xl font-black [overflow-wrap:anywhere] uppercase xl:text-3xl">
            {achievement.title}
          </h2>
        </div>
        <p
          className={`mt-3 text-lg font-bold [overflow-wrap:anywhere] ${isBattlePlacement ? "xl:mt-0 xl:min-w-0 xl:pr-16" : ""}`}
        >
          {achievement.requirement}
        </p>
        <button
          type="button"
          aria-label="Dismiss achievement"
          disabled={isAcknowledgementPending}
          onClick={() => onPresented(achievement.id)}
          className="absolute top-4 right-4 min-h-11 min-w-11 cursor-pointer border-4 border-black bg-white px-3 py-1 text-xl font-black text-black shadow-[4px_4px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black disabled:cursor-wait disabled:opacity-60 xl:top-5 xl:right-5"
        >
          ×
        </button>
      </div>
    </motion.aside>
  )
}

"use client"

import { PRODUCT_MENU_COPY } from "@game/data/src/ProductMenu"
import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"

function AchievementCard({
  achievement,
}: {
  readonly achievement: AchievementPresentation
}) {
  const isUnlocked = achievement.status === "unlocked"

  return (
    <li
      className={
        isUnlocked
          ? "bg-mapache-vivid-secondary-gold text-mapache-vivid-black min-w-0 border-4 border-black p-4 shadow-[5px_5px_0px_0px_#000000] sm:p-5"
          : "text-mapache-vivid-dark min-w-0 border-4 border-black bg-white p-4 shadow-[5px_5px_0px_0px_#000000] sm:p-5"
      }
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <h2 className="min-w-0 flex-1 text-2xl font-black [overflow-wrap:anywhere] uppercase sm:text-3xl">
          {achievement.title}
        </h2>
        <span className="shrink-0 border-4 border-black bg-black px-3 py-1 font-black text-white uppercase">
          {isUnlocked ? "Unlocked" : "Not unlocked"}
        </span>
      </div>
      <p className="mt-3 text-lg font-bold [overflow-wrap:anywhere]">
        {achievement.requirement}
      </p>
      {achievement.progress ? (
        <div className="mt-4 border-t-4 border-black pt-3">
          <p className="font-black [overflow-wrap:anywhere]">
            {achievement.progress.label}
          </p>
          {achievement.progress.kind === "numeric" ? (
            <progress
              aria-hidden="true"
              className="mt-3 h-4 w-full accent-black"
              max={achievement.progress.target}
              value={achievement.progress.current}
            />
          ) : null}
        </div>
      ) : null}
      {achievement.unlockedAt && achievement.unlockedDate ? (
        <p className="mt-4 border-t-4 border-black pt-3 font-black">
          Unlocked{" "}
          <time dateTime={achievement.unlockedAt}>
            {achievement.unlockedDate}
          </time>
        </p>
      ) : null}
    </li>
  )
}

export default function Achievements({
  achievements,
  canOpenMenu,
  onClose,
  onOpenMenu,
}: {
  readonly achievements: readonly AchievementPresentation[]
  readonly canOpenMenu: boolean
  readonly onClose: () => void
  readonly onOpenMenu: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const unlockedCount = achievements.filter(
    ({ status }) => status === "unlocked",
  ).length

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <main className="noise-bg bg-mapache-vivid-dark min-h-[100dvh] w-full p-4 sm:p-8">
      <header className="mx-auto flex w-full max-w-5xl flex-col items-stretch gap-5 xl:flex-row xl:items-center xl:justify-between">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-mapache-vivid-primary-cyan text-4xl font-black [overflow-wrap:anywhere] uppercase drop-shadow-[5px_5px_0px_#000000] outline-none sm:text-6xl"
        >
          Achievements
        </h1>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={!canOpenMenu}
            onClick={onOpenMenu}
            className="flex-1 whitespace-normal"
          >
            {PRODUCT_MENU_COPY.openAction}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={!canOpenMenu}
            onClick={onClose}
            className="flex-1 whitespace-normal"
          >
            Back to Your Values
          </Button>
        </div>
      </header>

      <section
        aria-labelledby="achievement-catalog-heading"
        className="mx-auto mt-8 w-full max-w-5xl border-4 border-black bg-white p-4 shadow-[8px_8px_0px_0px_#000000] sm:p-8"
      >
        <h2
          id="achievement-catalog-heading"
          className="text-mapache-vivid-dark text-3xl font-black uppercase sm:text-4xl"
        >
          Local Milestones
        </h2>
        <p className="text-mapache-vivid-dark mt-3 text-lg font-bold sm:text-xl">
          Private, offline progress. No leaderboards or social comparison.
        </p>
        <p className="bg-mapache-vivid-secondary-green text-mapache-vivid-dark mt-5 border-4 border-black p-4 text-xl font-black uppercase">
          {unlockedCount} of {achievements.length} unlocked
        </p>
        <ol className="mt-6 flex min-w-0 flex-col gap-5 pr-1 pb-2">
          {achievements.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </ol>
      </section>
    </main>
  )
}

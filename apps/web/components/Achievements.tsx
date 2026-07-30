"use client"

import { ACHIEVEMENT_CATALOG } from "@game/machines/src/AchievementCatalog"
import {
  formatAchievementUnlockedDate,
  getAchievementProgress,
} from "@game/machines/src/AchievementPresentation"
import type { AchievementState } from "@game/machines/src/AchievementState"
import type { BattleProfile } from "@game/machines/src/BattleProfile"

export default function Achievements({
  achievementState,
  battleProfile,
  onClose,
}: {
  achievementState: AchievementState
  battleProfile: BattleProfile
  onClose: () => void
}) {
  const unlockById = new Map(
    achievementState.unlocks.map((unlock) => [unlock.id, unlock]),
  )

  return (
    <main className="noise-bg bg-mapache-vivid-dark flex min-h-[100dvh] w-full flex-col items-center p-4 sm:p-8">
      <div className="flex w-full max-w-5xl flex-wrap items-center justify-between gap-4">
        <h1 className="text-mapache-vivid-primary-cyan text-4xl font-black uppercase drop-shadow-[5px_5px_0px_#000000] sm:text-6xl">
          Achievements
        </h1>
        <button
          type="button"
          onClick={onClose}
          className="bg-mapache-vivid-primary-cyan text-mapache-vivid-dark min-h-12 cursor-pointer border-4 border-black px-5 py-3 text-lg font-black uppercase shadow-[6px_6px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          Back to Your Values
        </button>
      </div>

      <section className="mt-8 flex w-full max-w-5xl flex-col gap-5 border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] sm:p-8">
        <p className="text-mapache-vivid-dark text-lg font-bold sm:text-xl">
          Clear milestones from your private, offline progress. Achievements do
          not compare you with anyone else.
        </p>
        <p
          role="status"
          className="bg-mapache-vivid-secondary-green text-mapache-vivid-dark border-4 border-black p-4 text-xl font-black uppercase"
        >
          {achievementState.unlocks.length} of {ACHIEVEMENT_CATALOG.length}{" "}
          unlocked
        </p>
        <ol className="flex max-h-[65dvh] flex-col gap-4 overflow-y-auto overscroll-contain pr-2">
          {ACHIEVEMENT_CATALOG.map((achievement) => {
            const unlock = unlockById.get(achievement.id)

            return (
              <li
                key={achievement.id}
                className={
                  unlock
                    ? "bg-mapache-vivid-primary-yellow text-mapache-vivid-dark border-4 border-black p-4 shadow-[5px_5px_0px_0px_#000000]"
                    : "text-mapache-vivid-dark border-4 border-black bg-white p-4 shadow-[5px_5px_0px_0px_#000000]"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-2xl font-black uppercase">
                    {achievement.title}
                  </h2>
                  <span className="border-4 border-black bg-black px-3 py-1 font-black text-white uppercase">
                    {unlock ? "Unlocked" : "Locked"}
                  </span>
                </div>
                <p className="mt-3 text-lg font-bold">
                  {achievement.description}
                </p>
                <p className="mt-2 font-black">
                  {getAchievementProgress({
                    achievement,
                    achievementState,
                    battleProfile,
                  })}
                </p>
                {unlock ? (
                  <p className="mt-2 font-black">
                    Unlocked{" "}
                    <time dateTime={unlock.unlockedAt}>
                      {formatAchievementUnlockedDate(unlock.unlockedAt)}
                    </time>
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
      </section>
    </main>
  )
}

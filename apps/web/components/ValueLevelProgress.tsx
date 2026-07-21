import { getLevelProgressFromXP } from "@game/utils/src/LevelMath"

export default function ValueLevelProgress({ totalXp }: { totalXp: number }) {
  const { level, earnedXpTowardNextLevel, requiredXpForNextLevel } =
    getLevelProgressFromXP(totalXp)
  const progressPercentage =
    (earnedXpTowardNextLevel / requiredXpForNextLevel) * 100

  return (
    <div
      aria-label={`Level ${level}: ${earnedXpTowardNextLevel} of ${requiredXpForNextLevel} XP toward Level ${level + 1}`}
      className="text-mapache-vivid-primary-raspberry min-w-44 border-4 border-black bg-white px-3 py-2 font-black uppercase"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xl">Level {level}</span>
        <span className="text-base">
          {earnedXpTowardNextLevel}/{requiredXpForNextLevel} XP
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`XP toward Level ${level + 1}`}
        aria-valuemin={0}
        aria-valuemax={requiredXpForNextLevel}
        aria-valuenow={earnedXpTowardNextLevel}
        className="mt-2 h-3 overflow-hidden border-2 border-black bg-white"
      >
        <div
          className="bg-mapache-vivid-primary-raspberry h-full"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  )
}

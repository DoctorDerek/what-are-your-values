import { getLevelProgressFromXP } from "@game/utils/src/LevelMath"
import { Progress } from "@/components/ui/progress"

export default function ValueLevelProgress({ totalXp }: { totalXp: number }) {
  const { level, earnedXpTowardNextLevel, requiredXpForNextLevel } =
    getLevelProgressFromXP(totalXp)
  return (
    <div
      aria-label={`Level ${level}: ${earnedXpTowardNextLevel} of ${requiredXpForNextLevel} XP toward Level ${level + 1}`}
      className="text-mapache-vivid-primary-raspberry w-full min-w-0 basis-full border-4 border-black bg-white px-3 py-2 font-black uppercase sm:w-auto sm:min-w-44 sm:basis-auto"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xl">Level {level}</span>
        <span className="text-base">
          {earnedXpTowardNextLevel}/{requiredXpForNextLevel} XP
        </span>
      </div>
      <Progress
        aria-label={`XP toward Level ${level + 1}`}
        value={earnedXpTowardNextLevel}
        max={requiredXpForNextLevel}
        className="mt-2 h-3 overflow-hidden border-2 border-black bg-white"
        indicatorClassName="bg-mapache-vivid-primary-raspberry"
      />
    </div>
  )
}

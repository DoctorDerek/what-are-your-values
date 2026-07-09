"use client"

import { LIST_OF_VALUES } from "@what-are-your-values-mapache/data/src/ListOfValues"
import { getLevelFromXP } from "@what-are-your-values-mapache/utils/src/LevelMath"

export default function Hub({
  valuesXp,
  onStartBattle,
}: {
  valuesXp: Record<number, number>
  onStartBattle: () => void
}) {
  const rankedValues = Object.entries(valuesXp)
    .map(([idStr, xp]) => {
      const id = parseInt(idStr, 10)
      const valObj = LIST_OF_VALUES.find((v) => v.id === id)
      return {
        id,
        name: valObj?.value || "UNKNOWN",
        xp,
        level: getLevelFromXP(xp),
      }
    })
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 5)

  return (
    <div className="bg-mapache-vivid-dark noise-bg flex min-h-[100dvh] w-[100dvw] flex-col items-center p-8">
      <h1 className="text-mapache-vivid-primary-cyan mt-8 mb-16 text-center text-5xl font-black uppercase drop-shadow-[6px_6px_0px_#000000] lg:text-7xl">
        Sovereign Dashboard
      </h1>

      <div className="flex w-full max-w-7xl flex-col gap-12 lg:flex-row">
        <div className="bg-mapache-vivid-primary-blue flex flex-1 flex-col items-center justify-center border-4 border-black p-12 shadow-[12px_12px_0px_0px_#000000]">
          <div className="mb-8 text-[14rem] leading-none drop-shadow-[8px_8px_0px_#000000]">
            🦝
          </div>
          <h2 className="bg-mapache-vivid-dark border-4 border-black px-8 py-4 text-4xl font-black text-white uppercase drop-shadow-[4px_4px_0px_#000000]">
            Avatar (Phase C)
          </h2>
        </div>

        <div className="flex flex-1 flex-col border-4 border-black bg-white p-10 shadow-[12px_12px_0px_0px_#000000]">
          <h2 className="text-mapache-vivid-dark mb-8 border-b-8 border-black pb-6 text-5xl font-black uppercase lg:text-6xl">
            Personal Totem Pole
          </h2>
          <div className="flex flex-col gap-6">
            {rankedValues.map((v, idx) => (
              <div
                key={v.id}
                className="bg-mapache-vivid-secondary-purple flex items-center justify-between border-4 border-black p-6 shadow-[6px_6px_0px_0px_#000000]"
              >
                <span className="text-3xl font-black text-white uppercase drop-shadow-[2px_2px_0px_#000000]">
                  #{idx + 1} {v.name}
                </span>
                <span className="text-mapache-vivid-primary-raspberry border-4 border-black bg-white px-4 py-2 text-3xl font-black uppercase">
                  LVL {v.level}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onStartBattle}
        className="bg-mapache-vivid-primary-orange mt-16 w-full max-w-7xl cursor-pointer border-4 border-black py-10 text-7xl font-black text-white uppercase shadow-[12px_12px_0px_0px_#000000] transition-transform hover:-translate-y-2 hover:shadow-[16px_16px_0px_0px_#000000] active:translate-x-[12px] active:translate-y-[12px] active:shadow-none lg:text-8xl"
      >
        Battle
      </button>
    </div>
  )
}

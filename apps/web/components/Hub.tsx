"use client"

import { LIST_OF_VALUES } from "@what-are-your-values-mapache/data/src/list-of-values"
import { getLevelFromXP } from "@what-are-your-values-mapache/utils/src/math"

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
    <div className="flex min-h-[100dvh] w-[100dvw] flex-col items-center bg-mapache-vivid-dark p-8 noise-bg">
      <h1 className="mb-16 mt-8 text-center text-5xl lg:text-7xl font-black uppercase text-mapache-vivid-primary-cyan drop-shadow-[6px_6px_0px_#000000]">
        Sovereign Dashboard
      </h1>

      <div className="flex w-full max-w-7xl flex-col gap-12 lg:flex-row">
        <div className="flex flex-1 flex-col items-center justify-center border-4 border-black bg-mapache-vivid-primary-blue p-12 shadow-[12px_12px_0px_0px_#000000]">
          <div className="mb-8 text-[14rem] leading-none drop-shadow-[8px_8px_0px_#000000]">
            🦝
          </div>
          <h2 className="text-4xl font-black uppercase text-white drop-shadow-[4px_4px_0px_#000000] border-4 border-black bg-mapache-vivid-dark px-8 py-4">
            Avatar (Phase C)
          </h2>
        </div>

        <div className="flex flex-1 flex-col border-4 border-black bg-white p-10 shadow-[12px_12px_0px_0px_#000000]">
          <h2 className="mb-8 border-b-8 border-black pb-6 text-5xl lg:text-6xl font-black uppercase text-mapache-vivid-dark">
            Personal Totem Pole
          </h2>
          <div className="flex flex-col gap-6">
            {rankedValues.map((v, idx) => (
              <div
                key={v.id}
                className="flex items-center justify-between border-4 border-black bg-mapache-vivid-secondary-purple p-6 shadow-[6px_6px_0px_0px_#000000]"
              >
                <span className="text-3xl font-black uppercase text-white drop-shadow-[2px_2px_0px_#000000]">
                  #{idx + 1} {v.name}
                </span>
                <span className="text-3xl border-4 border-black bg-white px-4 py-2 font-black uppercase text-mapache-vivid-primary-raspberry">
                  LVL {v.level}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onStartBattle}
        className="mt-16 w-full max-w-7xl cursor-pointer border-4 border-black bg-mapache-vivid-primary-orange py-10 text-7xl lg:text-8xl font-black uppercase text-white shadow-[12px_12px_0px_0px_#000000] transition-transform active:translate-x-[12px] active:translate-y-[12px] active:shadow-none hover:-translate-y-2 hover:shadow-[16px_16px_0px_0px_#000000]"
      >
        Battle
      </button>
    </div>
  )
}

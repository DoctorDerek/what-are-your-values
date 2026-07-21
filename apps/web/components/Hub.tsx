"use client"

import { getValueDisplayName } from "@game/data/src/Value"
import type { RankedValue } from "@game/data/src/ValueRanking"
import type { Ref } from "react"
import ValueDefinitionDisclosure from "@/components/ValueDefinitionDisclosure"
import ValueLevelProgress from "@/components/ValueLevelProgress"

export default function Hub({
  rankedValues,
  seeAllValuesButtonRef,
  onSeeAllValues,
  onStartBattle,
}: {
  rankedValues: readonly RankedValue[]
  seeAllValuesButtonRef?: Ref<HTMLButtonElement>
  onSeeAllValues: () => void
  onStartBattle: () => void
}) {
  const hasComparisons = rankedValues.some(
    ({ progress }) => progress.profileComparisons > 0,
  )
  const topFive = hasComparisons ? rankedValues.slice(0, 5) : []

  return (
    <div className="bg-mapache-vivid-dark noise-bg flex min-h-[100dvh] w-[100dvw] flex-col items-center p-8">
      <h1 className="text-mapache-vivid-primary-cyan mt-8 mb-16 text-center text-5xl font-black uppercase drop-shadow-[6px_6px_0px_#000000] lg:text-7xl">
        Sovereign Dashboard
      </h1>

      <section
        aria-labelledby="top-five-heading"
        className="flex w-full max-w-7xl flex-1 flex-col border-4 border-black bg-white p-6 shadow-[12px_12px_0px_0px_#000000] sm:p-10"
      >
        <h2
          id="top-five-heading"
          className="text-mapache-vivid-dark mb-8 border-b-8 border-black pb-6 text-5xl font-black uppercase lg:text-6xl"
        >
          Top Five
        </h2>
        {hasComparisons ? (
          <ol className="flex flex-col gap-6">
            {topFive.map(({ rank, definition, progress }) => (
              <li
                key={definition.id}
                className="bg-mapache-vivid-secondary-purple border-4 border-black p-5 shadow-[6px_6px_0px_0px_#000000] sm:p-6"
              >
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
                  <span className="min-w-0 text-3xl font-black [overflow-wrap:anywhere] break-words text-white uppercase drop-shadow-[2px_2px_0px_#000000]">
                    #{rank} {getValueDisplayName(definition)}
                  </span>
                  {definition.kind === "custom" ? (
                    <span className="bg-mapache-vivid-primary-cyan border-4 border-black px-3 py-2 text-lg font-black text-black uppercase">
                      Yours
                    </span>
                  ) : null}
                  <ValueLevelProgress totalXp={progress.totalXp} />
                </div>
                <div className="mt-4">
                  <ValueDefinitionDisclosure definition={definition} />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-mapache-vivid-dark my-auto text-center text-4xl leading-tight font-black">
            Keep comparing values to reveal your Top Five.
          </p>
        )}
      </section>

      <button
        ref={seeAllValuesButtonRef}
        type="button"
        onClick={onSeeAllValues}
        className="bg-mapache-vivid-primary-cyan text-mapache-vivid-dark mt-10 w-full max-w-7xl cursor-pointer border-4 border-black py-5 text-4xl font-black uppercase shadow-[10px_10px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[10px] active:translate-y-[10px] active:shadow-none"
      >
        See All Values
      </button>

      <button
        onClick={onStartBattle}
        className="bg-mapache-vivid-primary-orange mt-16 w-full max-w-7xl cursor-pointer border-4 border-black py-10 text-7xl font-black text-white uppercase shadow-[12px_12px_0px_0px_#000000] transition-transform hover:-translate-y-2 hover:shadow-[16px_16px_0px_0px_#000000] active:translate-x-[12px] active:translate-y-[12px] active:shadow-none lg:text-8xl"
      >
        Battle
      </button>
    </div>
  )
}

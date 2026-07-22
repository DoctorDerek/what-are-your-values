"use client"

import {
  getValueDisplayDefinition,
  getValueDisplayName,
} from "@game/data/src/Value"
import type { RankedValue } from "@game/data/src/ValueRanking"
import { useEffect, useMemo, useState } from "react"
import ValueLevelProgress from "@/components/ValueLevelProgress"

export default function AllValues({
  rankedValues,
  onClose,
}: {
  rankedValues: readonly RankedValue[]
  onClose: () => void
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
  const visibleValues = useMemo(
    () =>
      normalizedQuery.length === 0
        ? rankedValues
        : rankedValues.filter(({ definition }) =>
            getValueDisplayName(definition)
              .toLocaleLowerCase()
              .includes(normalizedQuery),
          ),
    [normalizedQuery, rankedValues],
  )
  const hasComparisons = rankedValues.some(
    ({ progress }) => progress.profileComparisons > 0,
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <main className="noise-bg bg-mapache-vivid-dark min-h-[100dvh] w-full text-white">
      <header className="bg-mapache-vivid-dark sticky top-0 z-20 border-b-8 border-black px-4 py-4 shadow-[0_8px_0px_0px_#000000] sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-mapache-vivid-primary-cyan text-4xl font-black [overflow-wrap:anywhere] break-words uppercase drop-shadow-[4px_4px_0px_#000000] sm:text-6xl">
              All Values
            </h1>
            <p className="mt-2 text-xl font-black uppercase sm:text-2xl">
              {rankedValues.length} Active Values
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-mapache-vivid-secondary-red cursor-pointer border-4 border-black px-5 py-3 text-2xl font-black uppercase shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
          >
            Close
          </button>
        </div>
      </header>

      <section
        aria-labelledby="all-values-search-heading"
        className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8"
      >
        <h2 id="all-values-search-heading" className="sr-only">
          Search the current ranking
        </h2>
        <label
          htmlFor="all-values-search"
          className="mb-3 block text-2xl font-black uppercase"
        >
          Search Values
        </label>
        <input
          id="all-values-search"
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search by value name"
          className="text-mapache-vivid-dark focus-visible:ring-mapache-vivid-primary-cyan w-full border-4 border-black bg-white px-5 py-4 text-2xl font-bold shadow-[8px_8px_0px_0px_#000000] outline-none focus-visible:ring-8"
        />
        <p
          role="status"
          aria-live="polite"
          className="mt-5 text-lg font-black uppercase"
        >
          {visibleValues.length}{" "}
          {visibleValues.length === 1 ? "Value Shown" : "Values Shown"}
        </p>

        {visibleValues.length > 0 ? (
          <ol className="mt-8 flex flex-col gap-5">
            {visibleValues.map(({ rank, definition, progress }) => {
              const displayName = getValueDisplayName(definition)
              const isTopFive = hasComparisons && rank <= 5

              return (
                <li
                  key={definition.id}
                  className="text-mapache-vivid-dark border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] sm:p-7"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-5">
                    <span
                      aria-label={`Rank ${rank}`}
                      className="bg-mapache-vivid-secondary-purple border-4 border-black px-3 py-2 text-2xl font-black text-white uppercase"
                    >
                      #{rank}
                    </span>
                    <h3 className="min-w-0 flex-1 text-3xl font-black [overflow-wrap:anywhere] break-words uppercase sm:text-4xl">
                      {displayName}
                    </h3>
                    {isTopFive ? (
                      <span className="bg-mapache-vivid-primary-orange border-4 border-black px-3 py-2 text-lg font-black text-white uppercase">
                        Top Five
                      </span>
                    ) : null}
                    {definition.kind === "custom" ? (
                      <span className="bg-mapache-vivid-primary-cyan border-4 border-black px-3 py-2 text-lg font-black text-black uppercase">
                        Yours
                      </span>
                    ) : null}
                    <ValueLevelProgress totalXp={progress.totalXp} />
                  </div>
                  <p className="mt-5 border-t-4 border-black pt-4 text-xl leading-relaxed font-bold [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                    “{getValueDisplayDefinition(definition)}”
                  </p>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="mt-8 border-4 border-black bg-white p-8 text-center text-2xl font-black text-black shadow-[8px_8px_0px_0px_#000000]">
            No values match your search.
          </p>
        )}
      </section>
    </main>
  )
}

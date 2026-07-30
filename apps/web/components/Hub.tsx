"use client"

import { getValueDisplayName, type ValueId } from "@game/data/src/Value"
import {
  sortRankedValuesAlphabetically,
  type RankedValue,
} from "@game/data/src/ValueRanking"
import type { Ref } from "react"
import ValueLevelProgress from "@/components/ValueLevelProgress"

function ValueRow({
  rankedValue,
  hasComparisons,
  onOpenValue,
}: {
  rankedValue: RankedValue
  hasComparisons: boolean
  onOpenValue: (valueId: ValueId, focusTargetId: string) => void
}) {
  const { definition, progress, rank } = rankedValue
  const displayName = getValueDisplayName(definition)
  const rowId = `hub-value-${definition.id}`

  return (
    <li
      id={rowId}
      data-value-row="true"
      className="text-mapache-vivid-dark border-4 border-black bg-white shadow-[6px_6px_0px_0px_#000000]"
    >
      <button
        id={`${rowId}-button`}
        type="button"
        onClick={(event) => onOpenValue(definition.id, event.currentTarget.id)}
        className="flex w-full min-w-0 cursor-pointer flex-wrap items-center gap-4 p-4 text-left hover:-translate-y-1 hover:shadow-[0_6px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black sm:gap-6 sm:p-5"
        aria-label={`Open ${displayName} in All Values`}
      >
        {hasComparisons ? (
          <span
            aria-label={`Rank ${rank}`}
            className="bg-mapache-vivid-secondary-purple border-4 border-black px-3 py-2 text-2xl font-black text-white uppercase"
          >
            #{rank}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 text-2xl font-black [overflow-wrap:anywhere] break-words uppercase sm:text-3xl">
          {displayName}
        </span>
        <ValueLevelProgress totalXp={progress.totalXp} />
      </button>
    </li>
  )
}

function ValueActionRail({
  browseAllValuesButtonRef,
  onBrowseAllValues,
  onAddCustomValue,
  onManageData,
  onStartBattle,
}: {
  browseAllValuesButtonRef?: Ref<HTMLButtonElement>
  onBrowseAllValues: (focusTargetId: string) => void
  onAddCustomValue: (focusTargetId: string) => void
  onManageData: (focusTargetId: string) => void
  onStartBattle: () => void
}) {
  return (
    <nav
      aria-label="Value actions"
      className="mt-6 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <button
        type="button"
        onClick={onStartBattle}
        className="bg-mapache-vivid-primary-orange min-h-16 flex-1 cursor-pointer border-4 border-black px-5 py-5 text-4xl font-black text-white uppercase shadow-[10px_10px_0px_0px_#000000] transition-transform hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[10px] active:translate-y-[10px] active:shadow-none"
      >
        Battle
      </button>
      <button
        ref={browseAllValuesButtonRef}
        id="hub-browse-all-values-button"
        type="button"
        onClick={(event) => onBrowseAllValues(event.currentTarget.id)}
        className="bg-mapache-vivid-primary-cyan text-mapache-vivid-dark min-h-16 flex-1 cursor-pointer border-4 border-black px-5 py-5 text-2xl font-black uppercase shadow-[8px_8px_0px_0px_#000000] transition-transform hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[8px] active:translate-y-[8px] active:shadow-none"
      >
        Browse All Values
      </button>
      <button
        id="hub-add-custom-value-button"
        type="button"
        onClick={(event) => onAddCustomValue(event.currentTarget.id)}
        className="bg-mapache-vivid-secondary-purple min-h-16 flex-1 cursor-pointer border-4 border-black px-5 py-5 text-2xl font-black text-white uppercase shadow-[8px_8px_0px_0px_#000000] transition-transform hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[8px] active:translate-y-[8px] active:shadow-none"
      >
        Add Custom Value
      </button>
      <button
        id="hub-manage-data-button"
        type="button"
        onClick={(event) => onManageData(event.currentTarget.id)}
        className="bg-mapache-vivid-secondary-green text-mapache-vivid-dark min-h-16 flex-1 cursor-pointer border-4 border-black px-5 py-5 text-2xl font-black uppercase shadow-[8px_8px_0px_0px_#000000] transition-transform hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-[8px] active:translate-y-[8px] active:shadow-none"
      >
        Manage Data
      </button>
    </nav>
  )
}

export default function Hub({
  notice,
  rankedValues,
  browseAllValuesButtonRef,
  onBrowseAllValues,
  onAddCustomValue,
  onManageData,
  onOpenValue,
  onStartBattle,
}: {
  notice?: string | null
  rankedValues: readonly RankedValue[]
  browseAllValuesButtonRef?: Ref<HTMLButtonElement>
  onBrowseAllValues: (focusTargetId: string) => void
  onAddCustomValue: (focusTargetId: string) => void
  onManageData: (focusTargetId: string) => void
  onOpenValue: (valueId: ValueId, focusTargetId: string) => void
  onStartBattle: () => void
}) {
  const hasComparisons = rankedValues.some(
    ({ progress }) => progress.profileComparisons > 0,
  )
  const visibleValues = hasComparisons
    ? rankedValues
    : sortRankedValuesAlphabetically(rankedValues)
  const topFive = visibleValues.slice(0, 5)
  const remainingValues = visibleValues.slice(5)

  return (
    <main className="noise-bg bg-mapache-vivid-dark flex min-h-[100dvh] w-full flex-col items-center p-4 sm:p-8">
      <h1 className="text-mapache-vivid-primary-cyan mt-8 mb-8 text-center text-5xl font-black uppercase drop-shadow-[6px_6px_0px_#000000] lg:text-7xl">
        Your Values
      </h1>

      {notice ? (
        <p
          role="status"
          className="bg-mapache-vivid-secondary-green text-mapache-vivid-dark mb-6 w-full max-w-7xl border-4 border-black p-4 text-xl font-black shadow-[6px_6px_0px_0px_#000000]"
        >
          {notice}
        </p>
      ) : null}

      <section
        aria-labelledby="your-values-heading"
        className="flex min-h-0 w-full max-w-7xl flex-1 flex-col border-4 border-black bg-white p-4 shadow-[12px_12px_0px_0px_#000000] sm:p-8"
      >
        <h2
          id="your-values-heading"
          className="text-mapache-vivid-dark border-b-8 border-black pb-5 text-4xl font-black uppercase sm:text-5xl"
        >
          {hasComparisons ? "Your Values" : "Included Values"}
        </h2>
        <p
          role="status"
          className="text-mapache-vivid-dark py-5 text-xl font-black uppercase sm:text-2xl"
        >
          {hasComparisons
            ? "Your ranking is based on your committed battles."
            : "Not ranked yet. Browse the included values, then battle when you are ready."}
        </p>

        {hasComparisons ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2">
            <section aria-labelledby="top-five-heading">
              <h3
                id="top-five-heading"
                className="text-mapache-vivid-dark border-b-4 border-black py-4 text-3xl font-black uppercase"
              >
                Top Five
              </h3>
              <ol className="flex flex-col gap-4 py-4">
                {topFive.map((rankedValue) => (
                  <ValueRow
                    key={rankedValue.definition.id}
                    rankedValue={rankedValue}
                    hasComparisons
                    onOpenValue={onOpenValue}
                  />
                ))}
              </ol>
            </section>
            <ValueActionRail
              browseAllValuesButtonRef={browseAllValuesButtonRef}
              onBrowseAllValues={onBrowseAllValues}
              onAddCustomValue={onAddCustomValue}
              onManageData={onManageData}
              onStartBattle={onStartBattle}
            />
            <div className="bg-mapache-vivid-primary-cyan border-y-8 border-black px-4 py-3 text-center text-2xl font-black text-black uppercase">
              All Other Values
            </div>
            <section aria-labelledby="all-other-values-heading">
              <h3 id="all-other-values-heading" className="sr-only">
                All Other Values
              </h3>
              <ol className="flex flex-col gap-4 py-4">
                {remainingValues.map((rankedValue) => (
                  <ValueRow
                    key={rankedValue.definition.id}
                    rankedValue={rankedValue}
                    hasComparisons
                    onOpenValue={onOpenValue}
                  />
                ))}
              </ol>
            </section>
          </div>
        ) : (
          <>
            <ValueActionRail
              browseAllValuesButtonRef={browseAllValuesButtonRef}
              onBrowseAllValues={onBrowseAllValues}
              onAddCustomValue={onAddCustomValue}
              onManageData={onManageData}
              onStartBattle={onStartBattle}
            />
            <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-2">
              {visibleValues.map((rankedValue) => (
                <ValueRow
                  key={rankedValue.definition.id}
                  rankedValue={rankedValue}
                  hasComparisons={false}
                  onOpenValue={onOpenValue}
                />
              ))}
            </ol>
          </>
        )}
      </section>
    </main>
  )
}

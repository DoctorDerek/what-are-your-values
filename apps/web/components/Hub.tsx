"use client"

import { projectHubValues } from "@game/data/src/HubValueProjection"
import { PRODUCT_MENU_COPY } from "@game/data/src/ProductMenu"
import {
  resolveValueAnimalPresentation,
  type SeethingSwarmAnimalPresentationAdapter,
  type ValueAnimalPresentation,
} from "@game/data/src/SeethingSwarmAnimalPresentation"
import { getValueDisplayName, type ValueId } from "@game/data/src/Value"
import type { RankedValue } from "@game/data/src/ValueRanking"
import type { StaticImageData } from "next/image"
import type { Ref } from "react"
import MapacheScreen from "@/components/MapacheScreen"
import SeethingSwarmAnimal from "@/components/SeethingSwarmAnimal"
import { Button } from "@/components/ui/button"
import ValueLevelProgress from "@/components/ValueLevelProgress"

export const HUB_MENU_BUTTON_ID = "hub-menu-button"

function ValueRankPresentation({
  rank,
  valuePresentation,
  shouldReduceMotion,
}: {
  rank: number
  valuePresentation: ValueAnimalPresentation<StaticImageData> | undefined
  shouldReduceMotion: boolean
}) {
  if (!valuePresentation || valuePresentation.kind === "typography-only")
    return (
      <span
        aria-label={`Rank ${rank}`}
        data-value-presentation="typography-only"
        className="bg-mapache-vivid-secondary-purple border-4 border-black px-3 py-2 text-2xl font-black text-white uppercase"
      >
        #{rank}
      </span>
    )

  return (
    <>
      <span
        aria-hidden="true"
        data-value-presentation={valuePresentation.kind}
        className="relative flex h-[72px] w-[72px] flex-none items-center justify-center overflow-hidden bg-white shadow-[inset_0_0_0_4px_#000000]"
      >
        {valuePresentation.kind === "animal" ? (
          <SeethingSwarmAnimal
            presentation={valuePresentation.animal}
            shouldReduceMotion={shouldReduceMotion}
          />
        ) : (
          <span className="text-mapache-vivid-secondary-purple text-4xl font-black uppercase">
            {valuePresentation.initial}
          </span>
        )}
        <span className="bg-mapache-vivid-secondary-purple absolute top-0 left-0 z-10 border-r-4 border-b-4 border-black px-1.5 py-1 text-sm leading-none font-black text-white uppercase">
          #{rank}
        </span>
      </span>
      <span aria-label={`Rank ${rank}`} className="sr-only">
        Rank {rank}
      </span>
    </>
  )
}

function ValueRow({
  rankedValue,
  hasComparisons,
  valuePresentation,
  shouldReduceMotion,
  onOpenValue,
}: {
  rankedValue: RankedValue
  hasComparisons: boolean
  valuePresentation?: ValueAnimalPresentation<StaticImageData>
  shouldReduceMotion: boolean
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
          <ValueRankPresentation
            rank={rank}
            valuePresentation={valuePresentation}
            shouldReduceMotion={shouldReduceMotion}
          />
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
  onStartBattle,
}: {
  browseAllValuesButtonRef?: Ref<HTMLButtonElement>
  onBrowseAllValues: (focusTargetId: string) => void
  onAddCustomValue: (focusTargetId: string) => void
  onStartBattle: () => void
}) {
  return (
    <nav
      aria-label="Value actions"
      className="mt-6 grid w-full grid-cols-1 gap-4 xl:grid-cols-3"
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
    </nav>
  )
}

export default function Hub({
  rankedValues,
  animalPresentationAdapter,
  browseAllValuesButtonRef,
  dataNotice,
  shouldReduceMotion,
  onBrowseAllValues,
  onAddCustomValue,
  onOpenMenu,
  onOpenValue,
  onStartBattle,
}: {
  rankedValues: readonly RankedValue[]
  animalPresentationAdapter: SeethingSwarmAnimalPresentationAdapter<StaticImageData>
  browseAllValuesButtonRef?: Ref<HTMLButtonElement>
  dataNotice: string | null
  shouldReduceMotion: boolean
  onBrowseAllValues: (focusTargetId: string) => void
  onAddCustomValue: (focusTargetId: string) => void
  onOpenMenu: () => void
  onOpenValue: (valueId: ValueId, focusTargetId: string) => void
  onStartBattle: () => void
}) {
  const { hasComparisons, visibleValues, topFive, remainingValues } =
    projectHubValues(rankedValues)

  return (
    <MapacheScreen
      spacing="standard"
      viewport="scrollable"
      className="flex flex-col items-center"
    >
      <div className="flex w-full max-w-7xl justify-end">
        <Button
          id={HUB_MENU_BUTTON_ID}
          type="button"
          variant="secondary"
          size="lg"
          onClick={onOpenMenu}
        >
          {PRODUCT_MENU_COPY.openAction}
        </Button>
      </div>

      <h1 className="text-mapache-vivid-primary-cyan mt-8 mb-8 text-center text-5xl font-black uppercase drop-shadow-[6px_6px_0px_#000000] lg:text-7xl">
        Your Values
      </h1>

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
        {dataNotice ? (
          <p
            role="status"
            className="bg-mapache-vivid-secondary-green text-mapache-vivid-dark mb-5 border-4 border-black p-4 text-xl font-black shadow-[6px_6px_0px_0px_#000000]"
          >
            {dataNotice}
          </p>
        ) : null}

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
                    valuePresentation={resolveValueAnimalPresentation(
                      rankedValue.definition,
                      animalPresentationAdapter,
                    )}
                    shouldReduceMotion={shouldReduceMotion}
                    onOpenValue={onOpenValue}
                  />
                ))}
              </ol>
            </section>
            <ValueActionRail
              browseAllValuesButtonRef={browseAllValuesButtonRef}
              onBrowseAllValues={onBrowseAllValues}
              onAddCustomValue={onAddCustomValue}
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
                    shouldReduceMotion={shouldReduceMotion}
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
              onStartBattle={onStartBattle}
            />
            <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-2">
              {visibleValues.map((rankedValue) => (
                <ValueRow
                  key={rankedValue.definition.id}
                  rankedValue={rankedValue}
                  hasComparisons={false}
                  shouldReduceMotion={shouldReduceMotion}
                  onOpenValue={onOpenValue}
                />
              ))}
            </ol>
          </>
        )}
      </section>
    </MapacheScreen>
  )
}

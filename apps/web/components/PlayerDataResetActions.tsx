"use client"

import {
  PLAYER_DATA_RESET_KINDS,
  type PlayerDataResetKind,
} from "@game/machines/src/PlayerDataReset"
import { playerDataResetCopy } from "@game/machines/src/PlayerDataResetCopy"
import { Button } from "@/components/ui/button"

export default function PlayerDataResetActions({
  customValueCount,
  isBusy,
  onRequestReset,
  playerDataResetKinds = PLAYER_DATA_RESET_KINDS,
}: {
  customValueCount: number
  isBusy: boolean
  onRequestReset: (
    resetKind: PlayerDataResetKind,
    focusTargetId: string,
  ) => void
  playerDataResetKinds?: readonly PlayerDataResetKind[]
}) {
  return (
    <section
      aria-labelledby="player-data-reset-actions-heading"
      className="mt-4 flex flex-col gap-5"
    >
      <h2
        id="player-data-reset-actions-heading"
        className="text-mapache-vivid-primary-cyan border-b-4 border-black pb-4 text-3xl font-black uppercase drop-shadow-[4px_4px_0px_#000000] sm:text-5xl"
      >
        Reset or Delete
      </h2>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {playerDataResetKinds.map((resetKind) => {
          const copy = playerDataResetCopy[resetKind]
          const buttonId = `player-data-${resetKind}-button`
          const descriptionId = `${buttonId}-description`
          const hasNothingToDelete =
            resetKind === "delete-all-custom-values" && customValueCount === 0
          const isCompleteErasure = resetKind === "delete-all-data"

          return (
            <article
              key={resetKind}
              className={`flex flex-col border-4 bg-white p-5 shadow-[8px_8px_0px_0px_#000000] sm:p-8 ${isCompleteErasure ? "border-mapache-vivid-secondary-red" : "border-black"}`}
            >
              <h3 className="text-mapache-vivid-dark border-b-4 border-black pb-4 text-2xl font-black uppercase sm:text-3xl">
                {copy.actionLabel}
              </h3>
              <p
                id={descriptionId}
                className="text-mapache-vivid-dark flex-1 py-5 text-lg font-bold sm:text-xl"
              >
                {copy.summary}
              </p>
              {hasNothingToDelete ? (
                <p className="text-mapache-vivid-dark mb-4 font-black">
                  No Custom Values to delete.
                </p>
              ) : null}
              <Button
                id={buttonId}
                type="button"
                variant={isCompleteErasure ? "destructive" : "outline"}
                size="lg"
                disabled={isBusy || hasNothingToDelete}
                aria-describedby={descriptionId}
                onClick={(event) =>
                  onRequestReset(resetKind, event.currentTarget.id)
                }
                className="w-full whitespace-normal"
              >
                {copy.actionLabel}
              </Button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

"use client"

import {
  DELETE_ALL_DATA_ACKNOWLEDGMENT,
  type PlayerDataResetReview as PlayerDataResetReviewState,
} from "@game/machines/src/PlayerDataReset"
import { playerDataResetCopy } from "@game/machines/src/PlayerDataResetCopy"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

export default function PlayerDataResetReview({
  isBusy,
  review,
  onCancel,
  onConfirm,
  onExport,
}: {
  isBusy: boolean
  review: PlayerDataResetReviewState
  onCancel: () => void
  onConfirm: (review: PlayerDataResetReviewState) => void
  onExport: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [acknowledgedCompleteErasure, setAcknowledgedCompleteErasure] =
    useState(false)
  const copy = playerDataResetCopy[review.resetKind]
  const requiresCompleteErasureAcknowledgment =
    review.resetKind === "delete-all-data"

  useEffect(() => {
    headingRef.current?.focus()
  }, [review.confirmationId])

  return (
    <section
      aria-labelledby="player-data-reset-review-heading"
      className="border-mapache-vivid-primary-orange flex flex-col gap-5 border-8 bg-white p-5 shadow-[10px_10px_0px_0px_#000000] sm:p-8"
    >
      <h2
        ref={headingRef}
        id="player-data-reset-review-heading"
        tabIndex={-1}
        className="text-mapache-vivid-dark border-b-4 border-black pb-4 text-3xl font-black uppercase outline-none sm:text-5xl"
      >
        {copy.confirmationTitle}
      </h2>

      <div className="text-mapache-vivid-dark flex flex-col gap-4 text-lg font-bold sm:text-xl">
        {copy.confirmationBody.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {requiresCompleteErasureAcknowledgment ? (
        <label className="text-mapache-vivid-dark bg-mapache-vivid-light flex min-h-14 cursor-pointer items-start gap-4 border-4 border-black p-4 text-lg font-black sm:text-xl">
          <input
            type="checkbox"
            checked={acknowledgedCompleteErasure}
            disabled={isBusy}
            onChange={(event) =>
              setAcknowledgedCompleteErasure(event.currentTarget.checked)
            }
            className="mt-1 size-6 shrink-0 accent-black"
          />
          <span>{DELETE_ALL_DATA_ACKNOWLEDGMENT}</span>
        </label>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={isBusy}
          onClick={onExport}
          className="w-full whitespace-normal"
        >
          Export Data
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isBusy}
          onClick={onCancel}
          className="w-full whitespace-normal"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="lg"
          disabled={
            isBusy ||
            (requiresCompleteErasureAcknowledgment &&
              !acknowledgedCompleteErasure)
          }
          onClick={() => onConfirm(review)}
          className="w-full whitespace-normal"
        >
          {copy.actionLabel}
        </Button>
      </div>
    </section>
  )
}

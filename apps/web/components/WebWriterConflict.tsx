"use client"

import { useEffect, useRef, useState } from "react"
import MapacheScreen from "@/components/MapacheScreen"
import { Button } from "@/components/ui/button"
import { webWriterConflictCopy } from "@/lib/WebWriterConflictCopy"

export default function WebWriterConflict({
  isExportPending,
  issue,
  notice,
  onExportThisTab,
  onLoadLatest,
}: {
  readonly isExportPending: boolean
  readonly issue: string | null
  readonly notice: string | null
  readonly onExportThisTab: () => void
  readonly onLoadLatest: () => void
}) {
  const [areOptionsVisible, setAreOptionsVisible] = useState(true)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const issueRef = useRef<HTMLParagraphElement>(null)
  const loadLatestButtonRef = useRef<HTMLButtonElement>(null)
  const reviewOptionsButtonRef = useRef<HTMLButtonElement>(null)
  const shouldFocusLoadLatestRef = useRef(false)
  const shouldFocusReviewOptionsRef = useRef(false)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    issueRef.current?.focus()
  }, [issue])

  useEffect(() => {
    if (areOptionsVisible && shouldFocusLoadLatestRef.current) {
      shouldFocusLoadLatestRef.current = false
      loadLatestButtonRef.current?.focus()
    }
    if (!areOptionsVisible && shouldFocusReviewOptionsRef.current) {
      shouldFocusReviewOptionsRef.current = false
      reviewOptionsButtonRef.current?.focus()
    }
  }, [areOptionsVisible])

  return (
    <MapacheScreen
      spacing="standard-xl"
      viewport="scrollable"
      className="flex flex-col items-center"
    >
      <div
        aria-busy={isExportPending}
        className="flex w-full max-w-5xl flex-col gap-5"
      >
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-mapache-vivid-primary-cyan text-4xl font-black uppercase drop-shadow-[5px_5px_0px_#000000] outline-none xl:text-6xl"
        >
          {webWriterConflictCopy.title}
        </h1>

        <p className="text-mapache-vivid-dark border-4 border-black bg-white p-5 text-xl font-black shadow-[8px_8px_0px_0px_#000000] xl:p-8 xl:text-2xl">
          {webWriterConflictCopy.message}
        </p>

        {isExportPending ? (
          <p
            role="status"
            className="bg-mapache-vivid-primary-cyan text-mapache-vivid-dark border-4 border-black p-4 text-xl font-black uppercase shadow-[6px_6px_0px_0px_#000000]"
          >
            {webWriterConflictCopy.exportActivity}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="bg-mapache-vivid-secondary-green text-mapache-vivid-dark border-4 border-black p-4 text-xl font-black shadow-[6px_6px_0px_0px_#000000]"
          >
            {notice}
          </p>
        ) : null}
        {issue ? (
          <p
            ref={issueRef}
            role="alert"
            tabIndex={-1}
            className="bg-mapache-vivid-primary-orange border-4 border-black p-4 text-xl font-black text-white shadow-[6px_6px_0px_0px_#000000] outline-none"
          >
            {issue}
          </p>
        ) : null}

        {areOptionsVisible ? (
          <div
            role="group"
            aria-label="Cross-tab recovery options"
            className="grid grid-cols-1 gap-4 xl:grid-cols-3"
          >
            <Button
              ref={loadLatestButtonRef}
              type="button"
              size="lg"
              disabled={isExportPending}
              onClick={onLoadLatest}
            >
              {webWriterConflictCopy.loadLatestAction}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={isExportPending}
              onClick={onExportThisTab}
            >
              {webWriterConflictCopy.exportThisTabAction}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isExportPending}
              onClick={() => {
                shouldFocusReviewOptionsRef.current = true
                setAreOptionsVisible(false)
              }}
            >
              {webWriterConflictCopy.cancelAction}
            </Button>
          </div>
        ) : (
          <Button
            ref={reviewOptionsButtonRef}
            type="button"
            variant="outline"
            size="lg"
            onClick={() => {
              shouldFocusLoadLatestRef.current = true
              setAreOptionsVisible(true)
            }}
          >
            {webWriterConflictCopy.reviewOptionsAction}
          </Button>
        )}
      </div>
    </MapacheScreen>
  )
}

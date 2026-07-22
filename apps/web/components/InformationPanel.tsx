"use client"

import type { ReactNode } from "react"
import { useId } from "react"

export default function InformationPanel({
  title,
  children,
  primaryActionLabel,
  onPrimaryAction,
}: {
  title: string
  children: ReactNode
  primaryActionLabel: string
  onPrimaryAction: () => void
}) {
  const titleId = useId()

  return (
    <main className="noise-bg bg-mapache-vivid-dark flex h-[100dvh] w-full items-stretch justify-center overflow-hidden p-4 text-center sm:p-6">
      <section
        aria-labelledby={titleId}
        className="grid min-h-0 w-full max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-4 border-black bg-white shadow-[12px_12px_0px_0px_#000000]"
      >
        <header className="border-b-4 border-black px-5 py-5 sm:px-10 sm:py-7">
          <h1
            id={titleId}
            className="text-mapache-vivid-primary-cyan text-4xl leading-tight font-black [overflow-wrap:anywhere] uppercase sm:text-5xl lg:text-7xl"
          >
            {title}
          </h1>
        </header>

        <div
          data-testid="information-panel-body"
          className="min-h-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-10 sm:py-8"
        >
          {children}
        </div>

        <footer className="border-t-4 border-black bg-white px-5 py-5 sm:px-10 sm:py-6">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="bg-mapache-vivid-primary-orange min-h-14 w-full cursor-pointer border-4 border-black px-4 py-4 text-4xl font-black text-white uppercase shadow-[8px_8px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black active:translate-x-[8px] active:translate-y-[8px] active:shadow-none sm:text-5xl"
          >
            {primaryActionLabel}
          </button>
        </footer>
      </section>
    </main>
  )
}

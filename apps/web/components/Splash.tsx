"use client"

import { useState } from "react"

export default function Splash({
  onComplete,
}: {
  onComplete: (optIn: boolean) => void
}) {
  const [optIn, setOptIn] = useState(true)

  return (
    <div className="flex min-h-[100dvh] w-[100dvw] flex-col items-center justify-center bg-mapache-vivid-dark p-6 text-center noise-bg">
      <div className="w-full max-w-4xl border-4 border-black bg-white p-12 shadow-[12px_12px_0px_0px_#000000]">
        <h1 className="mb-8 text-5xl font-black uppercase leading-tight text-mapache-vivid-primary-cyan lg:text-7xl">
          What Are Your Values, Mapache?
        </h1>
        <p className="mb-6 text-2xl font-bold text-black">
          A high-speed autobattler designed to help you find your values in
          life, as recommended by Acceptance &amp; Commitment Therapy (ACT) and
          the free WHO publication &ldquo;Doing What Matters In Times of
          Stress&rdquo;.
        </p>
        <p className="mb-12 text-xl font-medium text-gray-800">
          Knowing your own values can help you find meaning in life, reduce
          stress, and know yourself better. This tool will sort your priorities
          in 10-15 minutes for a quick result, and under an hour for a thorough
          profile. Plus, it&apos;s fun!
        </p>

        <div
          className="mb-12 flex cursor-pointer items-center justify-center gap-6 border-4 border-black bg-gray-100 p-6 hover:bg-gray-200 transition-colors"
          onClick={() => setOptIn(!optIn)}
        >
          <div
            className={`flex h-12 w-12 items-center justify-center border-4 border-black ${optIn ? "bg-mapache-vivid-primary-cyan" : "bg-white"}`}
          >
            {optIn && <div className="h-6 w-6 bg-black" />}
          </div>
          <span className="text-left text-2xl font-black uppercase text-black">
            Share Anonymous 1v1 Data To Global Leaderboard
          </span>
        </div>

        <button
          onClick={() => onComplete(optIn)}
          className="w-full cursor-pointer border-4 border-black bg-mapache-vivid-primary-orange py-8 text-6xl font-black uppercase text-white shadow-[8px_8px_0px_0px_#000000] transition-transform active:translate-x-[8px] active:translate-y-[8px] active:shadow-none"
        >
          Start
        </button>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"

export default function Splash({
  onComplete,
}: {
  onComplete: (optIn: boolean) => void
}) {
  const [optIn, setOptIn] = useState(true)

  return (
    <div className="bg-mapache-vivid-dark noise-bg flex min-h-[100dvh] w-[100dvw] flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-4xl border-4 border-black bg-white p-12 shadow-[12px_12px_0px_0px_#000000]">
        <h1 className="text-mapache-vivid-primary-cyan mb-8 text-5xl leading-tight font-black uppercase lg:text-7xl">
          What Are Your Values, Mapache?
        </h1>
        <p className="mb-12 text-2xl font-bold text-black">
          A high-speed autobattler designed to help you find your values in
          life.
        </p>

        <div
          className="mb-12 flex cursor-pointer items-center justify-center gap-6 border-4 border-black bg-gray-100 p-6 transition-colors hover:bg-gray-200"
          onClick={() => setOptIn(!optIn)}
        >
          <div
            className={`flex h-12 w-12 items-center justify-center border-4 border-black ${optIn ? "bg-mapache-vivid-primary-cyan" : "bg-white"}`}
          >
            {optIn && <div className="h-6 w-6 bg-black" />}
          </div>
          <span className="text-left text-2xl font-black text-black uppercase">
            Share Anonymous 1v1 Data To Global Leaderboard
          </span>
        </div>

        <button
          onClick={() => onComplete(optIn)}
          className="bg-mapache-vivid-primary-orange w-full cursor-pointer border-4 border-black py-8 text-6xl font-black text-white uppercase shadow-[8px_8px_0px_0px_#000000] transition-transform active:translate-x-[8px] active:translate-y-[8px] active:shadow-none"
        >
          Start
        </button>
      </div>
    </div>
  )
}

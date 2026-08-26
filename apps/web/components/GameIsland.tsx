"use client"

import { introductionCopy } from "@game/data/src/IntroductionCopy"
import dynamic from "next/dynamic"
import MapacheScreen from "@/components/MapacheScreen"

function GameIslandFallback() {
  return (
    <MapacheScreen
      aria-label="Loading game"
      viewport="fixed"
      spacing="standard-xl"
      className="grid place-items-center"
    >
      <div className="bg-mapache-vivid-light text-mapache-vivid-dark grid max-w-4xl gap-6 border-8 border-black p-6 text-center shadow-[12px_12px_0px_0px_#000000] xl:p-10">
        <h1 className="text-4xl leading-tight font-black uppercase xl:text-7xl">
          {introductionCopy.title}
        </h1>
        <p className="text-xl leading-relaxed font-bold xl:text-3xl">
          {introductionCopy.tagline}
        </p>
        <p role="status" aria-atomic="true" className="text-lg font-black">
          Loading game…
        </p>
        <p className="text-lg font-black">
          The interactive game requires JavaScript.
        </p>
        <a
          href="#introduction"
          className="bg-mapache-vivid-primary-cyan text-mapache-vivid-dark border-4 border-black p-4 text-xl font-black uppercase shadow-[6px_6px_0px_0px_#000000]"
        >
          Read the Introduction
        </a>
      </div>
    </MapacheScreen>
  )
}

const GameClient = dynamic(() => import("@/components/GameClient"), {
  ssr: false,
  loading: GameIslandFallback,
})

export default function GameIsland() {
  return (
    <section
      id="game"
      aria-label={`Play ${introductionCopy.title}`}
      className="min-h-[100dvh]"
    >
      <GameClient />
    </section>
  )
}

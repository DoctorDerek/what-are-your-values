"use client"
import dynamic from "next/dynamic"

const GameClient = dynamic(() => import("../components/GameClient"), { ssr: false })

export default function Page() {
  return <GameClient />
}

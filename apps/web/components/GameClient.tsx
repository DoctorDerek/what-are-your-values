"use client"

import { LIST_OF_VALUES } from "@game/data/src/ListOfValues"
import { rootMachine } from "@game/machines/src/RootMachine"
import { useMachine } from "@xstate/react"
import { useEffect } from "react"
import { webStorage } from "@/lib/WebStorage"
import Crucible from "./Crucible"
import Hub from "./Hub"
import Splash from "./Splash"

export default function GameClient() {
  const [state, send] = useMachine(rootMachine, {
    input: { storage: webStorage },
  })

  useEffect(() => {
    const uuid = webStorage.getItem("wayvm_uuid")
    const xpStr = webStorage.getItem("wayvm_values_xp")

    let valuesXp: Record<number, number> = {}
    if (xpStr) {
      valuesXp = JSON.parse(xpStr)
    }

    for (let i = 1; i <= LIST_OF_VALUES.length; i++) {
      if (typeof valuesXp[i] !== "number") {
        valuesXp[i] = 0
      }
    }

    send({ type: "HYDRATE", uuid, valuesXp })
  }, [send])

  if (state.matches("Hydrating")) {
    return (
      <div className="noise-bg bg-mapache-vivid-dark text-mapache-vivid-primary-cyan flex h-[100dvh] w-[100dvw] items-center justify-center text-6xl font-black uppercase drop-shadow-[4px_4px_0px_#000000]">
        Booting Machine...
      </div>
    )
  }

  if (state.matches("Splash")) {
    return (
      <Splash
        onComplete={() =>
          send({ type: "SUBMIT_SPLASH", uuid: crypto.randomUUID() })
        }
      />
    )
  }

  if (state.matches("Hub")) {
    return (
      <Hub
        valuesXp={state.context.valuesXp}
        onStartBattle={() => send({ type: "START_BATTLE" })}
      />
    )
  }

  if (state.matches("Crucible")) {
    return (
      <Crucible
        valuesXp={state.context.valuesXp}
        onExit={() => send({ type: "EXIT_BATTLE" })}
        onBattleCompleted={(
          winnerId: number,
          loserId: number,
          xpGained: number,
        ) => send({ type: "BATTLE_COMPLETED", winnerId, loserId, xpGained })}
      />
    )
  }

  return null
}

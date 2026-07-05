"use client"

import { rootMachine } from "@what-are-your-values-mapache/machines/src/rootMachine"
import { useMachine } from "@xstate/react"
import { useEffect } from "react"
import Crucible from "./Crucible"
import Hub from "./Hub"
import Splash from "./Splash"

export default function GameClient() {
  const [state, send] = useMachine(rootMachine)

  useEffect(() => {
    const uuid = window.localStorage.getItem("wayvm_uuid")
    const optInStr = window.localStorage.getItem("wayvm_opt_in")
    const xpStr = window.localStorage.getItem("wayvm_values_xp")

    let optIn = null
    if (optInStr === "true") optIn = true
    if (optInStr === "false") optIn = false

    let valuesXp: Record<number, number> = {}
    if (xpStr) {
      valuesXp = JSON.parse(xpStr)
    }

    for (let i = 1; i <= 83; i++) {
      if (typeof valuesXp[i] !== "number") {
        valuesXp[i] = 0
      }
    }

    send({ type: "HYDRATE", uuid, optIn, valuesXp })
  }, [send])

  if (state.matches("Hydrating")) {
    return (
      <div className="noise-bg flex h-[100dvh] w-[100dvw] items-center justify-center bg-mapache-vivid-dark text-6xl font-black uppercase text-mapache-vivid-primary-cyan drop-shadow-[4px_4px_0px_#000000]">
        Booting Machine...
      </div>
    )
  }

  if (state.matches("Splash")) {
    return (
      <Splash
        onComplete={(optIn: boolean) =>
          send({ type: "SUBMIT_OPT_IN", optIn, uuid: crypto.randomUUID() })
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

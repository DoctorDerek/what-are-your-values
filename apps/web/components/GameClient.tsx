"use client"

import type { ValueId } from "@game/data/src/Value"
import { rankValues } from "@game/data/src/ValueRanking"
import type { SchedulerRestorePoint } from "@game/machines/src/PairScheduler"
import { projectScheduledPair } from "@game/machines/src/PairScheduler"
import { rootMachine } from "@game/machines/src/RootMachine"
import { useMachine } from "@xstate/react"
import { useCallback, useEffect, useMemo } from "react"
import { webStorage } from "@/lib/WebStorage"
import Crucible from "./Crucible"
import Hub from "./Hub"
import Splash from "./Splash"

export default function GameClient() {
  const [state, send] = useMachine(rootMachine, {
    input: { storage: webStorage },
  })
  const battleCycle = state.context.battleCycle
  const rankedValues = useMemo(
    () =>
      battleCycle
        ? rankValues(battleCycle.activeDeck, battleCycle.progressById)
        : [],
    [battleCycle],
  )
  const presentedBattle = useMemo(
    () =>
      battleCycle
        ? Object.freeze({
            pair: projectScheduledPair(
              battleCycle.activeDeck,
              battleCycle.scheduler,
            ).pair,
            scheduler: battleCycle.scheduler,
          })
        : null,
    [battleCycle],
  )
  const handleWinnerSelected = useCallback(
    (winnerId: ValueId, expectedScheduler: SchedulerRestorePoint) => {
      send({
        type: "BATTLE.WINNER_SELECTED",
        winnerId,
        expectedScheduler,
      })
    },
    [send],
  )

  useEffect(() => {
    send({
      type: "APP.HYDRATED",
      uuid: webStorage.getItem("wayvm_uuid"),
      schedulerSeed: crypto.randomUUID(),
    })
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
          send({ type: "INTRODUCTION.COMPLETED", uuid: crypto.randomUUID() })
        }
      />
    )
  }

  if (!battleCycle || !presentedBattle) {
    throw new Error("Battle profile is unavailable after hydration")
  }

  if (state.matches("Hub")) {
    return (
      <Hub
        rankedValues={rankedValues}
        onStartBattle={() => send({ type: "BATTLE.START_REQUESTED" })}
      />
    )
  }

  if (state.matches("Crucible")) {
    return (
      <Crucible
        activeDeck={battleCycle.activeDeck}
        battle={presentedBattle}
        progressById={battleCycle.progressById}
        onExit={() => send({ type: "BATTLE.EXIT_REQUESTED" })}
        onWinnerSelected={handleWinnerSelected}
      />
    )
  }

  return null
}

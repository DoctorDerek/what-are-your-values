"use client"

import type { ValueId } from "@game/data/src/Value"
import { rankValues } from "@game/data/src/ValueRanking"
import type { SchedulerRestorePoint } from "@game/machines/src/PairScheduler"
import { projectScheduledPair } from "@game/machines/src/PairScheduler"
import { rootMachine } from "@game/machines/src/RootMachine"
import { useMachine } from "@xstate/react"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { webStorage } from "@/lib/WebStorage"
import AllValues from "./AllValues"
import Crucible from "./Crucible"
import Hub from "./Hub"
import Splash from "./Splash"

export default function GameClient() {
  const [state, send] = useMachine(rootMachine, {
    input: { storage: webStorage },
  })
  const seeAllValuesButtonRef = useRef<HTMLButtonElement>(null)
  const shouldRestoreSeeAllValuesFocusRef = useRef(false)
  const battleProfile = state.context.battleProfile
  const rankedValues = useMemo(
    () =>
      battleProfile
        ? rankValues(battleProfile.activeDeck, battleProfile.progressById)
        : [],
    [battleProfile],
  )
  const presentedBattle = useMemo(
    () =>
      battleProfile
        ? Object.freeze({
            pair: projectScheduledPair(
              battleProfile.activeDeck,
              battleProfile.scheduler,
            ).pair,
            scheduler: battleProfile.scheduler,
          })
        : null,
    [battleProfile],
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
  const handleAllValuesClose = useCallback(() => {
    shouldRestoreSeeAllValuesFocusRef.current = true
    send({ type: "ALL_VALUES.CLOSE_REQUESTED" })
  }, [send])

  useEffect(() => {
    send({
      type: "APP.HYDRATED",
      uuid: webStorage.getItem("wayvm_uuid"),
      schedulerSeed: crypto.randomUUID(),
    })
  }, [send])

  useEffect(() => {
    if (state.matches("Hub") && shouldRestoreSeeAllValuesFocusRef.current) {
      shouldRestoreSeeAllValuesFocusRef.current = false
      seeAllValuesButtonRef.current?.focus()
    }
  }, [state])

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

  if (!battleProfile || !presentedBattle) {
    throw new Error("Battle profile is unavailable after hydration")
  }

  if (state.matches("Hub")) {
    return (
      <Hub
        rankedValues={rankedValues}
        seeAllValuesButtonRef={seeAllValuesButtonRef}
        onSeeAllValues={() => send({ type: "ALL_VALUES.OPEN_REQUESTED" })}
        onStartBattle={() => send({ type: "BATTLE.START_REQUESTED" })}
      />
    )
  }

  if (state.matches("AllValues")) {
    return (
      <AllValues rankedValues={rankedValues} onClose={handleAllValuesClose} />
    )
  }

  if (state.matches("Crucible")) {
    return (
      <Crucible
        activeDeck={battleProfile.activeDeck}
        battle={presentedBattle}
        progressById={battleProfile.progressById}
        onExit={() => send({ type: "BATTLE.EXIT_REQUESTED" })}
        onWinnerSelected={handleWinnerSelected}
      />
    )
  }

  return null
}

"use client"

import type { ValueId } from "@game/data/src/Value"
import type { CustomValueId } from "@game/data/src/Value"
import { rankValues } from "@game/data/src/ValueRanking"
import type { SchedulerRestorePoint } from "@game/machines/src/PairScheduler"
import { projectScheduledPair } from "@game/machines/src/PairScheduler"
import { rootMachine } from "@game/machines/src/RootMachine"
import { useMachine } from "@xstate/react"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { createIndexedDbDurableStore } from "@/lib/IndexedDbDurableStore"
import { webStorage } from "@/lib/WebStorage"
import packageMetadata from "@/package.json"
import AllValues from "./AllValues"
import Crucible from "./Crucible"
import Hub from "./Hub"
import Splash from "./Splash"

export default function GameClient() {
  const durableStore = useMemo(() => createIndexedDbDurableStore(), [])
  const [state, send] = useMachine(rootMachine, {
    input: {
      storage: webStorage,
      durableStore,
      appVersion: packageMetadata.version,
      now: () => new Date().toISOString(),
    },
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
  const handleAddCustomValue = useCallback(
    (name: string, definition: string) => {
      send({
        type: "ALL_VALUES.ADD_REQUESTED",
        name,
        definition,
      })
    },
    [send],
  )
  const handleUpdateCustomValue = useCallback(
    (valueId: CustomValueId, name: string, definition: string) => {
      send({
        type: "ALL_VALUES.UPDATE_REQUESTED",
        valueId,
        name,
        definition,
      })
    },
    [send],
  )

  useEffect(() => {
    send({
      type: "APP.HYDRATED",
      schedulerSeed: crypto.randomUUID(),
    })
  }, [send])

  useEffect(() => {
    if (state.matches("Hub") && shouldRestoreSeeAllValuesFocusRef.current) {
      shouldRestoreSeeAllValuesFocusRef.current = false
      seeAllValuesButtonRef.current?.focus()
    }
  }, [state])

  if (
    state.matches("Hydrating") ||
    state.matches("LoadingProfile") ||
    state.matches("InitializingProfile")
  ) {
    return (
      <div className="noise-bg bg-mapache-vivid-dark text-mapache-vivid-primary-cyan flex h-[100dvh] w-[100dvw] items-center justify-center text-6xl font-black uppercase drop-shadow-[4px_4px_0px_#000000]">
        Booting Machine...
      </div>
    )
  }

  if (state.matches("PersistenceFailure")) {
    return (
      <main className="noise-bg bg-mapache-vivid-dark text-mapache-vivid-primary-cyan flex min-h-[100dvh] w-full flex-col items-center justify-center gap-6 p-8 text-center">
        <h1 className="max-w-4xl text-4xl font-black uppercase drop-shadow-[4px_4px_0px_#000000] sm:text-6xl">
          We couldn’t safely load your values.
        </h1>
        <p className="max-w-2xl text-xl font-bold text-white sm:text-2xl">
          Your saved data was left unchanged. Reload this page to try again.
        </p>
      </main>
    )
  }

  if (state.matches("Splash")) {
    return (
      <Splash
        onComplete={() => send({ type: "INTRODUCTION.COMPLETED" })}
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
      <AllValues
        rankedValues={rankedValues}
        onClose={handleAllValuesClose}
        onAddCustomValue={handleAddCustomValue}
        onUpdateCustomValue={handleUpdateCustomValue}
      />
    )
  }

  if (state.matches("Crucible")) {
    const isBattleReady = state.matches({ Crucible: "Ready" })

    return (
      <Crucible
        activeDeck={battleProfile.activeDeck}
        battle={presentedBattle}
        progressById={battleProfile.progressById}
        canUndo={battleProfile.history.length > 0}
        canRedo={battleProfile.redo.length > 0}
        isPersistencePending={!isBattleReady}
        onExit={() => send({ type: "BATTLE.EXIT_REQUESTED" })}
        onUndo={() => send({ type: "BATTLE.UNDO_REQUESTED" })}
        onRedo={() => send({ type: "BATTLE.REDO_REQUESTED" })}
        onWinnerSelected={handleWinnerSelected}
      />
    )
  }

  return null
}

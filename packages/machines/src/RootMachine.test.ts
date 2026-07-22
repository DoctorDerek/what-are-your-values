import { describe, expect, it, vi } from "vitest"
import { createActor } from "xstate"
import { projectScheduledPair } from "./PairScheduler"
import { rootMachine } from "./RootMachine"

function createStorage() {
  return {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  }
}

describe("Root Machine", () => {
  it("hydrates a fresh canonical profile and persists only introduction completion", () => {
    const storage = createStorage()
    const actor = createActor(rootMachine, { input: { storage } })
    actor.start()
    actor.send({
      type: "APP.HYDRATED",
      uuid: null,
      schedulerSeed: "fresh-profile-seed",
    })

    let snapshot = actor.getSnapshot()
    expect(snapshot.matches("Splash")).toBe(true)
    expect(snapshot.context.battleProfile?.activeDeck.valueIds).toHaveLength(
      100,
    )
    expect(snapshot.context.battleProfile?.history).toEqual([])
    expect(snapshot.context.battleProfile?.redo).toEqual([])
    expect(storage.setItem).not.toHaveBeenCalled()

    actor.send({
      type: "INTRODUCTION.COMPLETED",
      uuid: "profile-uuid",
    })
    snapshot = actor.getSnapshot()

    expect(snapshot.matches("Hub")).toBe(true)
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    expect(storage.setItem).toHaveBeenCalledWith("wayvm_uuid", "profile-uuid")
    expect(storage.setItem).not.toHaveBeenCalledWith(
      "wayvm_values_xp",
      expect.any(String),
    )
    expect(storage.setItem).not.toHaveBeenCalledWith(
      "wayvm_queue",
      expect.any(String),
    )
  })

  it("routes a returning introduction directly to the Hub", () => {
    const actor = createActor(rootMachine, {
      input: { storage: createStorage() },
    })
    actor.start()
    actor.send({
      type: "APP.HYDRATED",
      uuid: "returning-profile",
      schedulerSeed: "returning-profile-seed",
    })

    expect(actor.getSnapshot().matches("Hub")).toBe(true)
  })

  it("opens and closes All Values without replacing the battle profile", () => {
    const actor = createActor(rootMachine, {
      input: { storage: createStorage() },
    })
    actor.start()
    actor.send({
      type: "APP.HYDRATED",
      uuid: "all-values-profile",
      schedulerSeed: "all-values-profile-seed",
    })

    const battleProfile = actor.getSnapshot().context.battleProfile
    actor.send({ type: "ALL_VALUES.OPEN_REQUESTED" })

    expect(actor.getSnapshot().matches("AllValues")).toBe(true)
    expect(actor.getSnapshot().context.battleProfile).toBe(battleProfile)

    actor.send({ type: "ALL_VALUES.CLOSE_REQUESTED" })

    expect(actor.getSnapshot().matches("Hub")).toBe(true)
    expect(actor.getSnapshot().context.battleProfile).toBe(battleProfile)
  })

  it("commits one trusted battle and ignores duplicate stale selection events", () => {
    const actor = createActor(rootMachine, {
      input: { storage: createStorage() },
    })
    actor.start()
    actor.send({
      type: "APP.HYDRATED",
      uuid: "battle-profile",
      schedulerSeed: "root-battle-seed",
    })
    actor.send({ type: "BATTLE.START_REQUESTED" })

    const awaitingSnapshot = actor.getSnapshot()
    const awaitingBattleProfile = awaitingSnapshot.context.battleProfile
    if (!awaitingBattleProfile) {
      throw new Error("Battle profile did not initialize")
    }

    const [winnerId, loserId] = projectScheduledPair(
      awaitingBattleProfile.activeDeck,
      awaitingBattleProfile.scheduler,
    ).pair
    const selectionEvent = {
      type: "BATTLE.WINNER_SELECTED" as const,
      winnerId,
      expectedScheduler: awaitingBattleProfile.scheduler,
    }
    actor.send(selectionEvent)

    const committedSnapshot = actor.getSnapshot()
    const committedBattleProfile = committedSnapshot.context.battleProfile
    if (!committedBattleProfile) {
      throw new Error("Battle profile disappeared after selection")
    }

    expect(committedSnapshot.matches("Crucible")).toBe(true)
    expect(committedBattleProfile.scheduler.cursor).toBe(1)
    expect(committedBattleProfile.history).toHaveLength(1)
    expect(committedBattleProfile.redo).toEqual([])
    expect(committedBattleProfile.progressById.get(winnerId)).toMatchObject({
      totalXp: 1,
      profileWins: 1,
      profileComparisons: 1,
    })
    expect(committedBattleProfile.progressById.get(loserId)).toMatchObject({
      totalXp: 0,
      profileWins: 0,
      profileComparisons: 1,
    })

    actor.send(selectionEvent)
    expect(actor.getSnapshot().context.battleProfile).toBe(
      committedBattleProfile,
    )

    actor.send({ type: "BATTLE.EXIT_REQUESTED" })
    expect(actor.getSnapshot().matches("Hub")).toBe(true)
  })
})

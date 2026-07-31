import { describe, expect, it } from "vitest"
import { applyBattleChoice } from "./BattleProfile"
import { createBattleProfileCheckpoint } from "./BattleProfileCheckpoint"
import { createBattleChoiceEvent } from "./BattleProfileEvent"
import {
  createBattleProfileJournalCommit,
  serializeBattleProfileJournalRecord,
} from "./BattleProfileJournal"
import {
  replayAvailableBattleProfileJournal,
  replayBattleProfileJournalToGeneration,
} from "./BattleProfileJournalReplay"
import { getBattleProfileJournalKey } from "./BattleProfileStore"
import { projectScheduledPair } from "./PairScheduler"
import { createInitialPlayerData } from "./PlayerData"

async function createReplayFixture() {
  const initialPlayerData = createInitialPlayerData({
    schedulerSeed: "journal-replay-seed",
    createdAt: "2026-07-21T00:00:00.000Z",
  })
  const initialProfile = initialPlayerData.profile
  const [winnerId] = projectScheduledPair(
    initialProfile.activeDeck,
    initialProfile.scheduler,
  ).pair
  const transition = applyBattleChoice({
    profile: initialProfile,
    winnerId,
    expectedScheduler: initialProfile.scheduler,
  })
  const commit = await createBattleProfileJournalCommit({
    head: {
      generation: 0,
      revision: 0,
      playerData: initialPlayerData,
    },
    event: createBattleChoiceEvent(transition),
    committedAt: "2026-07-21T00:01:00.000Z",
  })
  const checkpoint = await createBattleProfileCheckpoint({
    generation: 0,
    revision: 0,
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
    appVersion: "0.1.0",
    playerData: initialPlayerData,
  })

  return {
    checkpoint,
    commit,
    entries: new Map([
      [
        getBattleProfileJournalKey(1),
        serializeBattleProfileJournalRecord(commit.record),
      ],
    ]),
  }
}

describe("Battle Profile Journal Replay", () => {
  it("replays a contiguous journal through an exact generation", async () => {
    const { checkpoint, commit, entries } = await createReplayFixture()

    await expect(
      replayBattleProfileJournalToGeneration({
        entries,
        checkpoint,
        headGeneration: 1,
      }),
    ).resolves.toEqual(commit.head)
  })

  it("stops available replay when the next journal generation is missing", async () => {
    const { checkpoint } = await createReplayFixture()

    await expect(
      replayAvailableBattleProfileJournal({
        entries: new Map(),
        checkpoint,
        maximumGeneration: 1,
      }),
    ).resolves.toMatchObject({
      head: {
        generation: 0,
        revision: 0,
        playerData: checkpoint.playerData,
      },
      updatedAt: checkpoint.updatedAt,
      stoppedIssue: "Battle Profile journal generation 1 is missing",
    })
  })

  it("stops available replay at a corrupted journal record", async () => {
    const { checkpoint, entries } = await createReplayFixture()
    const corruptedEntries = new Map([
      [
        getBattleProfileJournalKey(1),
        entries
          .get(getBattleProfileJournalKey(1))
          ?.replace("2026-07-21T00:01:00.000Z", "2026-07-21T00:01:01.000Z"),
      ],
    ])

    await expect(
      replayAvailableBattleProfileJournal({
        entries: corruptedEntries,
        checkpoint,
        maximumGeneration: 1,
      }),
    ).resolves.toMatchObject({
      head: {
        generation: 0,
        revision: 0,
      },
      stoppedIssue: "Journal content hash does not match",
    })
  })

  it("rejects an exact replay when the journal key disagrees with its record", async () => {
    const { checkpoint, commit } = await createReplayFixture()
    const secondPair = projectScheduledPair(
      commit.head.playerData.profile.activeDeck,
      commit.head.playerData.profile.scheduler,
    ).pair
    const secondTransition = applyBattleChoice({
      profile: commit.head.playerData.profile,
      winnerId: secondPair[0],
      expectedScheduler: commit.head.playerData.profile.scheduler,
    })
    const secondCommit = await createBattleProfileJournalCommit({
      head: commit.head,
      event: createBattleChoiceEvent(secondTransition),
      committedAt: "2026-07-21T00:02:00.000Z",
    })
    const mismatchedEntries = new Map([
      [
        getBattleProfileJournalKey(1),
        serializeBattleProfileJournalRecord(secondCommit.record),
      ],
    ])

    await expect(
      replayBattleProfileJournalToGeneration({
        entries: mismatchedEntries,
        checkpoint,
        headGeneration: 2,
      }),
    ).rejects.toThrow("Battle Profile journal key disagrees at generation 1")
  })
})

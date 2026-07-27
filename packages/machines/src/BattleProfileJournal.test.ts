import { describe, expect, it } from "vitest"
import {
  applyBattleChoice,
  applyBattleUndo,
  createInitialBattleProfile,
} from "./BattleProfile"
import {
  createBattleChoiceEvent,
  createBattleUndoEvent,
} from "./BattleProfileEvent"
import {
  applyBattleProfileJournalRecord,
  createBattleProfileJournalCommit,
  decodeBattleProfileJournalRecord,
  serializeBattleProfileJournalRecord,
} from "./BattleProfileJournal"
import { projectScheduledPair } from "./PairScheduler"
import { serializePersistedJson } from "./PersistedJson"

function createChoiceTransition() {
  const profile = createInitialBattleProfile("journal-seed")
  const [winnerId] = projectScheduledPair(
    profile.activeDeck,
    profile.scheduler,
  ).pair

  return {
    profile,
    transition: applyBattleChoice({
      profile,
      winnerId,
      expectedScheduler: profile.scheduler,
    }),
  }
}

describe("Battle Profile Journal", () => {
  it("round-trips and replays a contiguous checksummed battle event", async () => {
    const { profile, transition } = createChoiceTransition()
    const initialHead = { generation: 0, revision: 0, profile }
    const commit = await createBattleProfileJournalCommit({
      head: initialHead,
      event: createBattleChoiceEvent(transition),
      committedAt: "2026-07-21T00:01:00.000Z",
    })
    const serialized = serializeBattleProfileJournalRecord(commit.record)
    const decoded = await decodeBattleProfileJournalRecord(
      profile.activeDeck,
      serialized,
    )

    expect(decoded).toEqual(commit.record)
    expect(applyBattleProfileJournalRecord(initialHead, decoded)).toEqual(
      commit.head,
    )
    expect(commit.head).toEqual({
      generation: 1,
      revision: 1,
      profile: transition.profile,
    })
  })

  it("replays Undo through the same monotonic journal contract", async () => {
    const { transition } = createChoiceTransition()
    const undone = applyBattleUndo(transition.profile)
    if (!undone) {
      throw new Error("The committed battle cannot be undone")
    }
    const priorHead = {
      generation: 1,
      revision: 1,
      profile: transition.profile,
    }
    const commit = await createBattleProfileJournalCommit({
      head: priorHead,
      event: createBattleUndoEvent(undone),
      committedAt: "2026-07-21T00:02:00.000Z",
    })

    expect(commit.head).toEqual({
      generation: 2,
      revision: 2,
      profile: undone.profile,
    })
  })

  it("rejects stale heads and altered journal bytes", async () => {
    const { profile, transition } = createChoiceTransition()
    const initialHead = { generation: 0, revision: 0, profile }
    const commit = await createBattleProfileJournalCommit({
      head: initialHead,
      event: createBattleChoiceEvent(transition),
      committedAt: "2026-07-21T00:01:00.000Z",
    })

    expect(() =>
      applyBattleProfileJournalRecord(
        { ...initialHead, generation: 1 },
        commit.record,
      ),
    ).toThrow("Journal record does not match the current persistence head")
    await expect(
      decodeBattleProfileJournalRecord(
        profile.activeDeck,
        serializeBattleProfileJournalRecord(commit.record).replace(
          '"wayvm-journal-event",1,0,1',
          '"wayvm-journal-event",1,0,2',
        ),
      ),
    ).rejects.toThrow("Journal generation is not contiguous")
    await expect(
      decodeBattleProfileJournalRecord(
        profile.activeDeck,
        serializeBattleProfileJournalRecord(commit.record).replace(
          "2026-07-21T00:01:00.000Z",
          "2026-07-21T00:01:01.000Z",
        ),
      ),
    ).rejects.toThrow("Journal content hash does not match")
  })

  it("blocks unsafe generation and revision increments", async () => {
    const { profile, transition } = createChoiceTransition()

    await expect(
      createBattleProfileJournalCommit({
        head: {
          generation: Number.MAX_SAFE_INTEGER,
          revision: Number.MAX_SAFE_INTEGER,
          profile,
        },
        event: createBattleChoiceEvent(transition),
        committedAt: "2026-07-21T00:01:00.000Z",
      }),
    ).rejects.toThrow("Journal generation cannot be incremented safely")
  })

  it("rejects unsupported metadata, noncontiguous revisions, timestamps, and hashes", async () => {
    const { profile, transition } = createChoiceTransition()
    const commit = await createBattleProfileJournalCommit({
      head: { generation: 0, revision: 0, profile },
      event: createBattleChoiceEvent(transition),
      committedAt: "2026-07-21T00:01:00.000Z",
    })
    const encoded = JSON.parse(
      serializeBattleProfileJournalRecord(commit.record),
    ) as unknown[]
    const decodeTuple = (tuple: readonly unknown[]) =>
      decodeBattleProfileJournalRecord(
        profile.activeDeck,
        serializePersistedJson(tuple),
      )

    const unsupportedFormat = [...encoded]
    unsupportedFormat[0] = "future-journal"
    await expect(decodeTuple(unsupportedFormat)).rejects.toThrow(
      "Unsupported journal format",
    )

    const unsupportedSchema = [...encoded]
    unsupportedSchema[1] = 2
    await expect(decodeTuple(unsupportedSchema)).rejects.toThrow(
      "Unsupported journal schema version",
    )

    const noncontiguousRevision = [...encoded]
    noncontiguousRevision[5] = 2
    await expect(decodeTuple(noncontiguousRevision)).rejects.toThrow(
      "Journal revision is not contiguous",
    )

    const invalidTimestamp = [...encoded]
    invalidTimestamp[6] = "not-a-timestamp"
    await expect(decodeTuple(invalidTimestamp)).rejects.toThrow(
      "Invalid Journal commit timestamp",
    )

    const invalidHash = [...encoded]
    invalidHash[8] = "not-a-hash"
    await expect(decodeTuple(invalidHash)).rejects.toThrow(
      "Invalid Journal content hash",
    )
  })
})

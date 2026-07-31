import { type BattleProfileCheckpoint } from "./BattleProfileCheckpoint"
import {
  applyBattleProfileJournalRecord,
  decodeBattleProfileJournalRecord,
  type BattleProfilePersistenceHead,
} from "./BattleProfileJournal"
import { getBattleProfileJournalKey } from "./BattleProfileStore"

export function createBattleProfileCheckpointHead(
  checkpoint: BattleProfileCheckpoint,
): BattleProfilePersistenceHead {
  return Object.freeze({
    generation: checkpoint.generation,
    revision: checkpoint.revision,
    playerData: checkpoint.playerData,
  })
}

export async function replayBattleProfileJournalToGeneration({
  entries,
  checkpoint,
  headGeneration,
}: {
  readonly entries: ReadonlyMap<string, string>
  readonly checkpoint: BattleProfileCheckpoint
  readonly headGeneration: number
}) {
  let head = createBattleProfileCheckpointHead(checkpoint)

  for (
    let generation = checkpoint.generation + 1;
    generation <= headGeneration;
    generation += 1
  ) {
    const serialized = entries.get(getBattleProfileJournalKey(generation))
    if (!serialized) {
      throw new Error(
        `Battle Profile journal generation ${generation} is missing`,
      )
    }

    const record = await decodeBattleProfileJournalRecord(
      head.playerData.profile.activeDeck,
      serialized,
    )
    if (record.generation !== generation) {
      throw new Error(
        `Battle Profile journal key disagrees at generation ${generation}`,
      )
    }
    head = applyBattleProfileJournalRecord(head, record)
  }

  return head
}

export async function replayAvailableBattleProfileJournal({
  entries,
  checkpoint,
  maximumGeneration,
}: {
  readonly entries: ReadonlyMap<string, string>
  readonly checkpoint: BattleProfileCheckpoint
  readonly maximumGeneration: number
}) {
  let head = createBattleProfileCheckpointHead(checkpoint)
  let updatedAt = checkpoint.updatedAt
  let stoppedIssue: string | null = null

  for (
    let generation = checkpoint.generation + 1;
    generation <= maximumGeneration;
    generation += 1
  ) {
    const serialized = entries.get(getBattleProfileJournalKey(generation))
    if (!serialized) {
      stoppedIssue = `Battle Profile journal generation ${generation} is missing`
      break
    }

    try {
      const record = await decodeBattleProfileJournalRecord(
        head.playerData.profile.activeDeck,
        serialized,
      )
      if (record.generation !== generation) {
        throw new Error(
          `Battle Profile journal key disagrees at generation ${generation}`,
        )
      }
      head = applyBattleProfileJournalRecord(head, record)
      updatedAt = record.committedAt
    } catch (error: unknown) {
      stoppedIssue = error instanceof Error ? error.message : String(error)
      break
    }
  }

  return Object.freeze({ head, updatedAt, stoppedIssue })
}

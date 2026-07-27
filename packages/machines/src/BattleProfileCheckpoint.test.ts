import { describe, expect, it } from "vitest"
import { applyBattleChoice, createInitialBattleProfile } from "./BattleProfile"
import {
  createBattleProfileCheckpoint,
  decodeBattleProfileCheckpoint,
  serializeBattleProfileCheckpoint,
} from "./BattleProfileCheckpoint"
import { projectScheduledPair } from "./PairScheduler"
import { parsePersistedJson, serializePersistedJson } from "./PersistedJson"

async function createCheckpoint() {
  const initial = createInitialBattleProfile("checkpoint-seed")
  const [winnerId] = projectScheduledPair(
    initial.activeDeck,
    initial.scheduler,
  ).pair
  const profile = applyBattleChoice({
    profile: initial,
    winnerId,
    expectedScheduler: initial.scheduler,
  }).profile

  return createBattleProfileCheckpoint({
    generation: 1,
    revision: 1,
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:01:00.000Z",
    appVersion: "0.1.0",
    profile,
  })
}

describe("Battle Profile Checkpoint", () => {
  it("round-trips one canonical checksummed checkpoint", async () => {
    const checkpoint = await createCheckpoint()
    const serialized = serializeBattleProfileCheckpoint(checkpoint)

    await expect(decodeBattleProfileCheckpoint(serialized)).resolves.toEqual(
      checkpoint,
    )
    expect(checkpoint.contentHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it("rejects altered content and invalid hashes", async () => {
    const checkpoint = await createCheckpoint()
    const serialized = serializeBattleProfileCheckpoint(checkpoint)
    const alteredGeneration = serialized.replace(
      '"wayvm-save",1,1,1',
      '"wayvm-save",1,2,1',
    )
    const invalidHashTuple = parsePersistedJson(serialized)
    if (!Array.isArray(invalidHashTuple)) {
      throw new Error("The checkpoint fixture is not a tuple")
    }
    invalidHashTuple[9] = "invalid"
    const invalidHash = JSON.stringify(invalidHashTuple)

    await expect(
      decodeBattleProfileCheckpoint(alteredGeneration),
    ).rejects.toThrow("Checkpoint content hash does not match")
    await expect(decodeBattleProfileCheckpoint(invalidHash)).rejects.toThrow(
      "Invalid Checkpoint content hash",
    )
  })

  it("rejects unsupported metadata and noncanonical JSON", async () => {
    const checkpoint = await createCheckpoint()
    const serialized = serializeBattleProfileCheckpoint(checkpoint)

    await expect(
      decodeBattleProfileCheckpoint(
        serialized.replace('"wayvm-save"', '"future-save"'),
      ),
    ).rejects.toThrow("Unsupported checkpoint format")
    await expect(
      decodeBattleProfileCheckpoint(serialized.replace("[", "[ ")),
    ).rejects.toThrow("Battle Profile Checkpoint encoding is not canonical")
  })

  it("rejects unsupported schema and catalog versions before content validation", async () => {
    const checkpoint = await createCheckpoint()
    const serialized = serializeBattleProfileCheckpoint(checkpoint)
    const tuple = parsePersistedJson(serialized)
    if (!Array.isArray(tuple)) {
      throw new Error("The checkpoint fixture is not a tuple")
    }

    const unsupportedSchema = [...tuple]
    unsupportedSchema[1] = 2
    const unsupportedCatalog = [...tuple]
    unsupportedCatalog[7] = "future-catalog"

    await expect(
      decodeBattleProfileCheckpoint(serializePersistedJson(unsupportedSchema)),
    ).rejects.toThrow("Unsupported checkpoint schema version: 2")
    await expect(
      decodeBattleProfileCheckpoint(serializePersistedJson(unsupportedCatalog)),
    ).rejects.toThrow("Unsupported checkpoint catalog version: future-catalog")
  })

  it("rejects an empty app version before checking checkpoint integrity", async () => {
    const checkpoint = await createCheckpoint()
    const serialized = serializeBattleProfileCheckpoint(checkpoint)
    const tuple = parsePersistedJson(serialized)
    if (!Array.isArray(tuple)) {
      throw new Error("The checkpoint fixture is not a tuple")
    }

    const emptyAppVersion = [...tuple]
    emptyAppVersion[6] = ""

    await expect(
      decodeBattleProfileCheckpoint(serializePersistedJson(emptyAppVersion)),
    ).rejects.toThrow("Checkpoint app version is required")
  })

  it("rejects invalid metadata before hashing", async () => {
    await expect(
      createBattleProfileCheckpoint({
        generation: 0,
        revision: 0,
        createdAt: "2026-07-21T00:00:00.000Z",
        updatedAt: "2026-07-20T00:00:00.000Z",
        appVersion: "0.1.0",
        profile: createInitialBattleProfile("invalid-checkpoint-seed"),
      }),
    ).rejects.toThrow(
      "Checkpoint update timestamp precedes its creation timestamp",
    )
  })
})

import { describe, expect, it } from "vitest"
import { createActor, toPromise } from "xstate"
import {
  BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY,
  initializeBattleProfileStore,
} from "./BattleProfileStore"
import { createInMemoryDurableStore } from "./InMemoryDurableStore"
import { createInitialPlayerData } from "./PlayerData"
import {
  createWayvmExportActor,
  prepareWayvmImportActor,
  replacePlayerDataActor,
} from "./PlayerDataPortabilityActors"

const EXPORTED_AT = "2026-07-29T12:34:56.000Z"

function createPlayerData(seed: string) {
  return createInitialPlayerData({
    schedulerSeed: seed,
    createdAt: "2026-07-29T00:00:00.000Z",
  })
}

async function createPreparedDownload(seed: string) {
  const actor = createActor(createWayvmExportActor, {
    input: {
      exportedAt: EXPORTED_AT,
      sourceAppVersion: "0.1.0",
      sourceBuild: "test-build",
      playerData: createPlayerData(seed),
    },
  })
  actor.start()

  return toPromise(actor)
}

describe("Player Data Portability Actors", () => {
  it("prepares a canonical named download without exposing mutable output", async () => {
    const preparedDownload = await createPreparedDownload("download-seed")

    expect(preparedDownload.filename).toBe(
      "what-are-your-values-mapache-backup-2026-07-29-123456Z.json",
    )
    expect(preparedDownload.serialized).toContain('"wayvm-export"')
    expect(Object.isFrozen(preparedDownload)).toBe(true)
  })

  it("validates complete import bytes and projects a non-destructive preview", async () => {
    const preparedDownload = await createPreparedDownload("preview-seed")
    const actor = createActor(prepareWayvmImportActor, {
      input: { serialized: preparedDownload.serialized },
    })
    actor.start()

    const preparedImport = await toPromise(actor)

    expect(preparedImport.preview).toMatchObject({
      sourceAppVersion: "0.1.0",
      sourceBuild: "test-build",
      activeValueCount: 100,
      customValueCount: 0,
      replacesCurrentLocalData: true,
    })
    expect(preparedImport.wayvmExport.playerData.profile.history).toEqual([])
  })

  it("replaces complete Player Data and retains the supplied pre-import backup", async () => {
    const store = createInMemoryDurableStore()
    const initialPlayerData = createPlayerData("initial-seed")
    const importedPlayerData = createPlayerData("imported-seed")
    const state = await initializeBattleProfileStore({
      store,
      playerData: initialPlayerData,
      createdAt: "2026-07-29T00:00:00.000Z",
      appVersion: "0.1.0",
    })
    const actor = createActor(replacePlayerDataActor, {
      input: {
        store,
        state,
        playerData: importedPlayerData,
        preImportBackupBytes: "verified-pre-import-backup",
        replacedAt: EXPORTED_AT,
      },
    })
    actor.start()

    const replacedState = await toPromise(actor)

    expect(replacedState.head.playerData).toEqual(importedPlayerData)
    expect(replacedState.head.generation).toBe(1)
    expect(
      (await store.readAll()).get(BATTLE_PROFILE_PRE_IMPORT_BACKUP_KEY),
    ).toBe("verified-pre-import-backup")
  })
})

import { describe, expect, it } from "vitest"
import {
  createBattleProfileManifest,
  decodeBattleProfileManifest,
  serializeBattleProfileManifest,
} from "./BattleProfileManifest"

describe("Battle Profile Manifest", () => {
  it("round-trips the active checkpoint and bounded journal head", () => {
    const manifest = createBattleProfileManifest({
      activeSlot: "b",
      checkpointGeneration: 32,
      checkpointRevision: 32,
      headGeneration: 47,
      headRevision: 47,
    })

    expect(
      decodeBattleProfileManifest(serializeBattleProfileManifest(manifest)),
    ).toEqual(manifest)
  })

  it("rejects invalid slots, divergent ranges, and unbounded journals", () => {
    expect(() =>
      decodeBattleProfileManifest('["wayvm-manifest",1,"c",0,0,0,0]'),
    ).toThrow("Invalid Manifest active checkpoint slot")
    expect(() =>
      createBattleProfileManifest({
        activeSlot: "a",
        checkpointGeneration: 0,
        checkpointRevision: 0,
        headGeneration: 1,
        headRevision: 2,
      }),
    ).toThrow("Battle Profile Manifest journal ranges disagree")
    expect(() =>
      createBattleProfileManifest({
        activeSlot: "a",
        checkpointGeneration: 0,
        checkpointRevision: 0,
        headGeneration: 32,
        headRevision: 32,
      }),
    ).toThrow("Battle Profile Manifest journal range is not bounded")
  })

  it("rejects noncanonical encoded bytes", () => {
    expect(() =>
      decodeBattleProfileManifest('["wayvm-manifest",1,"a",0,0,0,0 ]'),
    ).toThrow("Battle Profile Manifest encoding is not canonical")
  })
})

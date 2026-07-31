import { describe, expect, it } from "vitest"
import { createInitialPlayerData } from "./PlayerData"
import { decodePlayerData, encodePlayerData } from "./PlayerDataCodec"

describe("Player Data Codec", () => {
  it("round-trips one complete canonical player-owned payload", () => {
    const playerData = createInitialPlayerData({
      schedulerSeed: "player-data-codec-seed",
      createdAt: "2026-07-29T00:00:00.000Z",
    })

    expect(decodePlayerData(encodePlayerData(playerData))).toEqual(playerData)
  })

  it("rejects unsupported versions and malformed generation timestamps", () => {
    const encoded = encodePlayerData(
      createInitialPlayerData({
        schedulerSeed: "invalid-player-data-codec-seed",
        createdAt: "2026-07-29T00:00:00.000Z",
      }),
    )

    expect(() => decodePlayerData([2, ...encoded.slice(1)])).toThrow(
      "Unsupported Player Data codec version",
    )
    expect(() =>
      decodePlayerData([...encoded.slice(0, 4), "2026-07-29"]),
    ).toThrow("Invalid Progress generation start timestamp")
  })

  it("rejects noncanonical tuple representations", () => {
    const encoded = encodePlayerData(
      createInitialPlayerData({
        schedulerSeed: "noncanonical-player-data-codec-seed",
        createdAt: "2026-07-29T00:00:00.000Z",
      }),
    )

    expect(() => decodePlayerData([...encoded, null])).toThrow(
      "Invalid Player Data",
    )
  })
})

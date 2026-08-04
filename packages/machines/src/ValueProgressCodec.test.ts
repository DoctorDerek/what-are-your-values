import { describe, expect, it } from "vitest"
import { applyBattleChoice, createInitialBattleProfile } from "./BattleProfile"
import { projectScheduledPair } from "./PairScheduler"
import {
  decodeValueProgressById,
  encodeValueProgressEntries,
} from "./ValueProgressCodec"

function createPlayedProfile() {
  const profile = createInitialBattleProfile("value-progress-codec-seed")
  const [winnerId] = projectScheduledPair(
    profile.activeDeck,
    profile.scheduler,
  ).pair

  return applyBattleChoice({
    profile,
    winnerId,
    expectedScheduler: profile.scheduler,
  }).profile
}

describe("Value Progress Codec", () => {
  it("round-trips every active Value Progress entry in canonical order", () => {
    const profile = createPlayedProfile()
    const encoded = encodeValueProgressEntries(profile.progressById)

    expect(decodeValueProgressById(profile.activeDeck, encoded)).toEqual(
      profile.progressById,
    )
    expect(encoded.map(([valueId]) => valueId)).toEqual(
      profile.activeDeck.valueIds,
    )
  })

  it("rejects incomplete, duplicate, noncanonical, and impossible progress", () => {
    const profile = createPlayedProfile()
    const encoded = encodeValueProgressEntries(profile.progressById)

    expect(() =>
      decodeValueProgressById(profile.activeDeck, encoded.slice(1)),
    ).toThrow("Value Progress does not cover the complete Active Deck")
    expect(() =>
      decodeValueProgressById(profile.activeDeck, [
        encoded[0],
        encoded[0],
        ...encoded.slice(2),
      ]),
    ).toThrow(`Duplicate Value Progress ID: ${encoded[0][0]}`)
    expect(() =>
      decodeValueProgressById(profile.activeDeck, [...encoded].reverse()),
    ).toThrow("Value Progress encoding is not canonical")
    expect(() =>
      decodeValueProgressById(profile.activeDeck, [
        [encoded[0][0], 0, 1, 0, 0],
        ...encoded.slice(1),
      ]),
    ).toThrow(`Profile wins exceed comparisons for ${encoded[0][0]}`)
    expect(() =>
      decodeValueProgressById(profile.activeDeck, [
        [encoded[0][0], 666, 0, 0, 0],
        ...encoded.slice(1),
      ]),
    ).toThrow(`Total XP is not divisible by 4 for ${encoded[0][0]}`)
  })
})

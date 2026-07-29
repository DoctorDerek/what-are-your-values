import { describe, expect, it, vi } from "vitest"
import { createInitialBattleProfile } from "./BattleProfile"
import {
  createCustomValueAddCommit,
  createCustomValueUpdateCommit,
} from "./CustomValueCommands"

const TEST_TIMESTAMP = "2026-07-29T00:00:00.000Z"

function addCustomValue(
  profile = createInitialBattleProfile("custom-value-command-seed"),
  name = "Ingenuity",
) {
  return createCustomValueAddCommit({
    profile,
    name,
    definition: "To solve problems in original and resourceful ways.",
    now: () => TEST_TIMESTAMP,
  })
}

describe("Custom Value Commands", () => {
  it("uses one timestamp for a validated Custom Value creation", () => {
    const now = vi.fn(() => TEST_TIMESTAMP)
    const commit = createCustomValueAddCommit({
      profile: createInitialBattleProfile("custom-value-timestamp-seed"),
      name: "  Ingenuity  ",
      definition: "  To solve problems in original and resourceful ways.  ",
      now,
    })
    const customValue = commit.profile.activeDeck.customValues[0]

    expect(now).toHaveBeenCalledTimes(1)
    expect(customValue).toMatchObject({
      name: "Ingenuity",
      definition: "To solve problems in original and resourceful ways.",
      createdAt: TEST_TIMESTAMP,
      updatedAt: TEST_TIMESTAMP,
    })
  })

  it("rejects canonical, compatibility-folded, overlong, and controlled names", () => {
    const profile = createInitialBattleProfile("custom-value-invalid-seed")
    const createCommit = (name: string) =>
      createCustomValueAddCommit({
        profile,
        name,
        definition: "A definition that must remain unsaved.",
        now: () => TEST_TIMESTAMP,
      })

    expect(() => createCommit("ＦＵＮ")).toThrow(
      "Custom Value name already exists",
    )
    expect(() => createCommit("🦝".repeat(61))).toThrow(
      "Custom Value name cannot exceed 60 grapheme clusters",
    )
    expect(() => createCommit("Meaning\u202e")).toThrow(
      "Custom Value name contains prohibited control characters",
    )
  })

  it("rejects invalid definitions before producing a deck revision", () => {
    const profile = createInitialBattleProfile(
      "custom-value-invalid-definition-seed",
    )
    const createCommit = (definition: string) =>
      createCustomValueAddCommit({
        profile,
        name: "Ingenuity",
        definition,
        now: () => TEST_TIMESTAMP,
      })

    expect(() => createCommit("é".repeat(281))).toThrow(
      "Custom Value definition cannot exceed 280 grapheme clusters",
    )
    expect(() => createCommit("Purpose\u0000")).toThrow(
      "Custom Value definition contains prohibited control characters",
    )
  })

  it("permits an unchanged edited name but rejects another Custom Value identity", () => {
    const ingenuityCommit = addCustomValue()
    const ingenuity = ingenuityCommit.profile.activeDeck.customValues[0]
    if (!ingenuity) {
      throw new Error("Expected Ingenuity in the revised deck")
    }

    const destinyCommit = addCustomValue(ingenuityCommit.profile, "Destiny")
    expect(() =>
      createCustomValueUpdateCommit({
        profile: destinyCommit.profile,
        valueId: ingenuity.id,
        name: "INGENUITY",
        definition: ingenuity.definition,
        now: () => TEST_TIMESTAMP,
      }),
    ).not.toThrow()
    expect(() =>
      createCustomValueUpdateCommit({
        profile: destinyCommit.profile,
        valueId: ingenuity.id,
        name: "DESTINY",
        definition: ingenuity.definition,
        now: () => TEST_TIMESTAMP,
      }),
    ).toThrow("Custom Value name already exists")
  })
})

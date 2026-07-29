import { describe, expect, it } from "vitest"
import {
  createInitialPlayerSettings,
  createPlayerSettings,
  decodePlayerSettings,
  encodePlayerSettings,
} from "./PlayerSettings"

describe("Player Settings", () => {
  it("creates the truthful launch defaults", () => {
    expect(createInitialPlayerSettings()).toEqual({
      locale: "en",
      reducedMotion: "system",
      controlHints: "auto",
      reflectionCards: "act-inspired",
    })
  })

  it("round-trips every supported setting choice", () => {
    const settings = createPlayerSettings({
      locale: "en",
      reducedMotion: "off",
      controlHints: "always",
      reflectionCards: "none",
    })

    expect(decodePlayerSettings(encodePlayerSettings(settings))).toEqual(
      settings,
    )
  })

  it.each([
    {
      index: 0,
      value: 2,
      issue: "Unsupported Player Settings codec version",
    },
    { index: 1, value: "es", issue: "Unsupported locale" },
    {
      index: 2,
      value: "sometimes",
      issue: "Unsupported reduced-motion preference",
    },
    {
      index: 3,
      value: "keyboard",
      issue: "Unsupported control-hint preference",
    },
    {
      index: 4,
      value: "logotherapy-inspired",
      issue: "Unsupported reflection-card preference",
    },
  ])(
    "rejects unsupported persisted settings at tuple index $index",
    ({ index, value, issue }) => {
      const encoded = [...encodePlayerSettings(createInitialPlayerSettings())]
      encoded[index] = value

      expect(() => decodePlayerSettings(encoded)).toThrow(issue)
    },
  )

  it("rejects noncanonical tuple representations", () => {
    expect(() =>
      decodePlayerSettings([1, "en", "system", "auto", "act-inspired", null]),
    ).toThrow("Invalid Player Settings")
  })
})

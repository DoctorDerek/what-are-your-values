import { describe, expect, it } from "vitest"
import {
  CONTROL_HINT_SETTING_OPTIONS,
  getInitialWebControlHintInputModality,
  getValueChoiceControlHint,
  PLAYER_SETTINGS_COPY,
  PLAYER_SETTINGS_LANGUAGE_OPTIONS,
  REDUCED_MOTION_SETTING_OPTIONS,
  resolveShouldReduceMotion,
  SETTINGS_PLAYER_DATA_RESET_KINDS,
} from "./PlayerSettingsPresentation"

describe("Player Settings presentation", () => {
  it("owns the immutable functional launch catalog", () => {
    expect(PLAYER_SETTINGS_COPY).toEqual({
      title: "Settings",
      closeAction: "Back",
      languageHeading: "Language",
      reducedMotionHeading: "Reduced Motion",
      controlHintsHeading: "Control Hints",
      resetHeading: "Reset or Delete",
      savingStatus: "Saving setting…",
    })
    expect(PLAYER_SETTINGS_LANGUAGE_OPTIONS).toEqual([
      { value: "en", label: "English" },
    ])
    expect(REDUCED_MOTION_SETTING_OPTIONS).toEqual([
      {
        value: "system",
        label: "Follow System",
        description: "Use your device or browser motion setting.",
      },
      { value: "on", label: "On", description: "Minimize movement." },
      { value: "off", label: "Off", description: "Use full motion." },
    ])
    expect(CONTROL_HINT_SETTING_OPTIONS).toEqual([
      {
        value: "auto",
        label: "Auto",
        description: "Show hints for your current input.",
      },
      {
        value: "always",
        label: "Always",
        description: "Always show the current input hint.",
      },
      { value: "off", label: "Off", description: "Hide control hints." },
    ])
    expect(SETTINGS_PLAYER_DATA_RESET_KINDS).toEqual([
      "reset-levels-and-experience",
      "reset-achievements",
      "delete-all-data",
    ])

    expect(Object.isFrozen(PLAYER_SETTINGS_COPY)).toBe(true)
    expect(Object.isFrozen(PLAYER_SETTINGS_LANGUAGE_OPTIONS)).toBe(true)
    expect(Object.isFrozen(REDUCED_MOTION_SETTING_OPTIONS)).toBe(true)
    expect(Object.isFrozen(CONTROL_HINT_SETTING_OPTIONS)).toBe(true)
    expect(Object.isFrozen(SETTINGS_PLAYER_DATA_RESET_KINDS)).toBe(true)
    expect(
      [
        ...PLAYER_SETTINGS_LANGUAGE_OPTIONS,
        ...REDUCED_MOTION_SETTING_OPTIONS,
        ...CONTROL_HINT_SETTING_OPTIONS,
      ].every((option) => Object.isFrozen(option)),
    ).toBe(true)
  })

  it.each([
    { preference: "system" as const, system: false, expected: false },
    { preference: "system" as const, system: true, expected: true },
    { preference: "on" as const, system: false, expected: true },
    { preference: "on" as const, system: true, expected: true },
    { preference: "off" as const, system: false, expected: false },
    { preference: "off" as const, system: true, expected: false },
  ])(
    "resolves $preference against system motion $system",
    ({ preference, system, expected }) => {
      expect(resolveShouldReduceMotion(preference, system)).toBe(expected)
    },
  )

  it("starts web hints from actual touch capability", () => {
    expect(getInitialWebControlHintInputModality(0)).toBe("keyboard")
    expect(getInitialWebControlHintInputModality(1)).toBe("touch-pointer")
    expect(getInitialWebControlHintInputModality(10)).toBe("touch-pointer")
  })

  it.each([
    {
      preference: "auto" as const,
      inputModality: "keyboard" as const,
      position: "first" as const,
      expected: "[1 / A]",
    },
    {
      preference: "auto" as const,
      inputModality: "keyboard" as const,
      position: "second" as const,
      expected: "[2 / D]",
    },
    {
      preference: "auto" as const,
      inputModality: "touch-pointer" as const,
      position: "first" as const,
      expected: null,
    },
    {
      preference: "always" as const,
      inputModality: "touch-pointer" as const,
      position: "second" as const,
      expected: "Tap",
    },
    {
      preference: "always" as const,
      inputModality: "keyboard" as const,
      position: "first" as const,
      expected: "[1 / A]",
    },
    {
      preference: "off" as const,
      inputModality: "keyboard" as const,
      position: "first" as const,
      expected: null,
    },
    {
      preference: "off" as const,
      inputModality: "touch-pointer" as const,
      position: "second" as const,
      expected: null,
    },
  ])(
    "resolves $preference $inputModality $position hints",
    ({ preference, inputModality, position, expected }) => {
      expect(
        getValueChoiceControlHint({
          preference,
          inputModality,
          position,
        }),
      ).toBe(expected)
    },
  )
})

import type { PlayerDataResetKind } from "./PlayerDataReset"
import type {
  ControlHintPreference,
  ReducedMotionPreference,
  SupportedLocale,
} from "./PlayerSettings"

export const PLAYER_SETTINGS_COPY = Object.freeze({
  title: "Settings",
  closeAction: "Back",
  languageHeading: "Language",
  reducedMotionHeading: "Reduced Motion",
  controlHintsHeading: "Control Hints",
  resetHeading: "Reset or Delete",
  savingStatus: "Saving setting…",
})

export const PLAYER_SETTINGS_LANGUAGE_OPTIONS = Object.freeze([
  Object.freeze({ value: "en", label: "English" }),
] as const satisfies readonly {
  readonly value: SupportedLocale
  readonly label: string
}[])

export const REDUCED_MOTION_SETTING_OPTIONS = Object.freeze([
  Object.freeze({
    value: "system",
    label: "Follow System",
    description: "Use your device or browser motion setting.",
  }),
  Object.freeze({
    value: "on",
    label: "On",
    description: "Minimize movement.",
  }),
  Object.freeze({
    value: "off",
    label: "Off",
    description: "Use full motion.",
  }),
] as const satisfies readonly {
  readonly value: ReducedMotionPreference
  readonly label: string
  readonly description: string
}[])

export const CONTROL_HINT_SETTING_OPTIONS = Object.freeze([
  Object.freeze({
    value: "auto",
    label: "Auto",
    description: "Show hints for your current input.",
  }),
  Object.freeze({
    value: "always",
    label: "Always",
    description: "Always show the current input hint.",
  }),
  Object.freeze({
    value: "off",
    label: "Off",
    description: "Hide control hints.",
  }),
] as const satisfies readonly {
  readonly value: ControlHintPreference
  readonly label: string
  readonly description: string
}[])

export const SETTINGS_PLAYER_DATA_RESET_KINDS = Object.freeze([
  "reset-levels-and-experience",
  "reset-achievements",
  "delete-all-data",
] as const satisfies readonly PlayerDataResetKind[])

export const CONTROL_HINT_INPUT_MODALITIES = Object.freeze([
  "keyboard",
  "touch-pointer",
] as const)

export type ControlHintInputModality =
  (typeof CONTROL_HINT_INPUT_MODALITIES)[number]

export type ValueChoicePosition = "first" | "second"

export function resolveShouldReduceMotion(
  preference: ReducedMotionPreference,
  systemShouldReduceMotion: boolean,
) {
  return (
    preference === "on" || (preference === "system" && systemShouldReduceMotion)
  )
}

export function getInitialWebControlHintInputModality(maxTouchPoints: number) {
  return maxTouchPoints > 0 ? "touch-pointer" : "keyboard"
}

export function getValueChoiceControlHint({
  preference,
  inputModality,
  position,
}: {
  readonly preference: ControlHintPreference
  readonly inputModality: ControlHintInputModality
  readonly position: ValueChoicePosition
}) {
  if (
    preference === "off" ||
    (preference === "auto" && inputModality !== "keyboard")
  )
    return null

  if (inputModality === "touch-pointer") return "Tap"

  return position === "first" ? "[1 / A]" : "[2 / D]"
}

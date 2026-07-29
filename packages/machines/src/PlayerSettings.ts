import { readString, readTuple } from "./PersistenceValidation"

export const PLAYER_SETTINGS_CODEC_VERSION = 1 as const

export const SUPPORTED_LOCALES = ["en"] as const
export const REDUCED_MOTION_PREFERENCES = ["system", "on", "off"] as const
export const CONTROL_HINT_PREFERENCES = ["auto", "always", "off"] as const
export const REFLECTION_CARD_PREFERENCES = ["act-inspired", "none"] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export type ReducedMotionPreference =
  (typeof REDUCED_MOTION_PREFERENCES)[number]
export type ControlHintPreference = (typeof CONTROL_HINT_PREFERENCES)[number]
export type ReflectionCardPreference =
  (typeof REFLECTION_CARD_PREFERENCES)[number]

export type PlayerSettings = {
  readonly locale: SupportedLocale
  readonly reducedMotion: ReducedMotionPreference
  readonly controlHints: ControlHintPreference
  readonly reflectionCards: ReflectionCardPreference
}

export type EncodedPlayerSettings = readonly [
  version: number,
  locale: string,
  reducedMotion: string,
  controlHints: string,
  reflectionCards: string,
]

function readOption<const TOption extends string>(
  value: unknown,
  options: readonly TOption[],
  label: string,
) {
  const candidate = readString(value, label)
  if (!options.includes(candidate as TOption)) {
    throw new Error(`Unsupported ${label}: ${candidate}`)
  }

  return candidate as TOption
}

export function createPlayerSettings(settings: PlayerSettings): PlayerSettings {
  return Object.freeze({
    locale: readOption(settings.locale, SUPPORTED_LOCALES, "locale"),
    reducedMotion: readOption(
      settings.reducedMotion,
      REDUCED_MOTION_PREFERENCES,
      "reduced-motion preference",
    ),
    controlHints: readOption(
      settings.controlHints,
      CONTROL_HINT_PREFERENCES,
      "control-hint preference",
    ),
    reflectionCards: readOption(
      settings.reflectionCards,
      REFLECTION_CARD_PREFERENCES,
      "reflection-card preference",
    ),
  })
}

export function createInitialPlayerSettings() {
  return createPlayerSettings({
    locale: "en",
    reducedMotion: "system",
    controlHints: "auto",
    reflectionCards: "act-inspired",
  })
}

export function encodePlayerSettings(
  settings: PlayerSettings,
): EncodedPlayerSettings {
  const validated = createPlayerSettings(settings)

  return [
    PLAYER_SETTINGS_CODEC_VERSION,
    validated.locale,
    validated.reducedMotion,
    validated.controlHints,
    validated.reflectionCards,
  ]
}

export function decodePlayerSettings(value: unknown) {
  const tuple = readTuple(value, 5, "Player Settings")
  if (tuple[0] !== PLAYER_SETTINGS_CODEC_VERSION) {
    throw new Error(
      `Unsupported Player Settings codec version: ${String(tuple[0])}`,
    )
  }

  const settings = createPlayerSettings({
    locale: readOption(tuple[1], SUPPORTED_LOCALES, "locale"),
    reducedMotion: readOption(
      tuple[2],
      REDUCED_MOTION_PREFERENCES,
      "reduced-motion preference",
    ),
    controlHints: readOption(
      tuple[3],
      CONTROL_HINT_PREFERENCES,
      "control-hint preference",
    ),
    reflectionCards: readOption(
      tuple[4],
      REFLECTION_CARD_PREFERENCES,
      "reflection-card preference",
    ),
  })

  if (
    JSON.stringify(encodePlayerSettings(settings)) !== JSON.stringify(value)
  ) {
    throw new Error("Player Settings encoding is not canonical")
  }

  return settings
}

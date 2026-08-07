import type { PlayerDataResetKind } from "./PlayerDataReset"

type PlayerDataResetCopy = {
  readonly actionLabel: string
  readonly summary: string
  readonly confirmationTitle: string
  readonly confirmationBody: readonly string[]
  readonly successAnnouncement: string
}

export const playerDataResetCopy = Object.freeze({
  "delete-all-custom-values": Object.freeze({
    actionLabel: "Delete All Custom Values",
    summary:
      "Remove every player-authored Custom Value while keeping canonical value progress, achievements, and settings.",
    confirmationTitle: "Delete All Custom Values?",
    confirmationBody: Object.freeze([
      "This permanently removes every player-authored Custom Value and that value’s XP, level, win/loss counters, and scheduler participation.",
      "It keeps the 100 canonical values and their progress, achievements and lifetime achievement progress, language, accessibility settings, controls, avatar customization, and other preferences.",
      "The active deck returns to the 100 canonical values. The deck revision advances, the current pair cycle and Undo and Redo history clear, and a fresh canonical schedule begins.",
      "This cannot be undone after you confirm. Export your data first if you may want it later.",
    ]),
    successAnnouncement:
      "All Custom Values were deleted. Canonical value progress, achievements, and settings were kept.",
  }),
  "reset-levels-and-experience": Object.freeze({
    actionLabel: "Reset Levels & Experience",
    summary:
      "Return every active value to Level 1 with 0 XP while keeping Custom Values, achievements, and settings.",
    confirmationTitle: "Reset Levels & Experience?",
    confirmationBody: Object.freeze([
      "This returns every active value to Level 1 with 0 XP, clears value win/loss counters, restarts the current pair cycle and reflection rotation, and clears Undo and Redo history.",
      "It advances the internal progress generation so restored scheduler state cannot cross the reset boundary. Your current value ranking restarts from an all-tied baseline.",
      "It keeps your Custom Value definitions, achievements and lifetime achievement progress, language, accessibility settings, controls, avatar customization, and other preferences.",
      "This cannot be undone after you confirm. Export your data first if you may want it later.",
    ]),
    successAnnouncement:
      "Levels and experience were reset. Custom Values, achievements, and settings were kept.",
  }),
  "reset-achievements": Object.freeze({
    actionLabel: "Reset Achievements",
    summary:
      "Clear local achievement unlocks and achievement-only progress while keeping your values and ranking.",
    confirmationTitle: "Reset Achievements?",
    confirmationBody: Object.freeze([
      "This clears unlocked achievements and achievement-only progress, including the lifetime battle count used for achievement milestones.",
      "It keeps your canonical and Custom Values, XP, levels, value win/loss counters, current pair cycle, Undo and Redo history, language, accessibility settings, controls, avatar customization, and other preferences.",
      "After reset, threshold achievements respond to future qualifying events; a threshold already satisfied does not silently unlock again without a new qualifying event. Use Reset Levels & Experience too if you want to replay level thresholds from the beginning.",
      "This cannot be undone after you confirm. Export your data first if you may want it later.",
    ]),
    successAnnouncement:
      "Achievements and achievement progress were reset. Your values, ranking, and settings were kept.",
  }),
  "delete-all-data": Object.freeze({
    actionLabel: "Delete All Data",
    summary:
      "Remove every WAYVM player-data record from this browser profile and return to Introduction.",
    confirmationTitle: "Delete All Data?",
    confirmationBody: Object.freeze([
      "This permanently removes all WAYVM player data from this device or browser profile, including levels, experience, Custom Values, achievements, current scheduling state, Undo and Redo history, language, settings, local backups, and control mappings.",
      "You will return to Introduction. This does not uninstall the app or remove the offline program files needed to open it. This cannot be undone. Export your data first if you may want it later.",
    ]),
    successAnnouncement: "All local WAYVM player data was deleted.",
  }),
}) satisfies Readonly<Record<PlayerDataResetKind, PlayerDataResetCopy>>

export const playerDataResetBackupReadyNotice =
  "Your private backup is ready. Review the reset when you are ready." as const

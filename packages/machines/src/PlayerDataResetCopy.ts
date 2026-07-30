import type { PlayerDataResetKind } from "./PlayerDataReset"

export const playerDataResetCopy = Object.freeze({
  "delete-all-custom-values": {
    action: "Delete All Custom Values",
    title: "Delete All Custom Values?",
    paragraphs: [
      "This permanently removes every player-authored Custom Value and that value’s XP, level, win/loss counters, and scheduler participation.",
      "It keeps the 100 canonical values and their progress, achievements and lifetime achievement progress, language, accessibility settings, controls, avatar customization, and other preferences.",
      "The active deck returns to the 100 canonical values. The deck revision advances, the current pair cycle and Undo and Redo history clear, and a fresh canonical schedule begins.",
      "This cannot be undone after you confirm. Export your data first if you may want it later.",
    ],
  },
  "reset-levels-and-experience": {
    action: "Reset Levels & Experience",
    title: "Reset Levels & Experience?",
    paragraphs: [
      "This returns every active value to Level 1 with 0 XP, clears value win/loss counters, restarts the current pair cycle and reflection rotation, and clears Undo and Redo history.",
      "It advances the internal progress generation so restored scheduler state cannot cross the reset boundary. Your current value ranking restarts from an all-tied baseline.",
      "It keeps your Custom Value definitions, achievements and lifetime achievement progress, language, accessibility settings, controls, avatar customization, and other preferences.",
      "This cannot be undone after you confirm. Export your data first if you may want it later.",
    ],
  },
  "reset-achievements": {
    action: "Reset Achievements",
    title: "Reset Achievements?",
    paragraphs: [
      "This clears unlocked achievements and achievement-only lifetime progress, including lifetime battle and completed-cycle counters.",
      "It keeps your canonical and Custom Values, XP, levels, value win/loss counters, current pair cycle, Undo and Redo history, language, accessibility settings, controls, avatar customization, and other preferences.",
      "After reset, threshold achievements respond to future qualifying events; a threshold already satisfied does not silently unlock again without a new qualifying event. Use Reset Levels & Experience too if you want to replay level thresholds from the beginning.",
      "This cannot be undone after you confirm. Export your data first if you may want it later.",
    ],
  },
  "delete-all-data": {
    action: "Delete All Data",
    title: "Delete All Data?",
    paragraphs: [
      "This permanently removes all WAYVM player data from this device or browser profile, including levels, experience, Custom Values, achievements, current scheduling state, Undo and Redo history, language, settings, local backups, and control mappings.",
      "You will return to Introduction. This does not uninstall the app or remove the offline program files needed to open it. This cannot be undone. Export your data first if you may want it later.",
    ],
  },
}) satisfies Readonly<
  Record<
    PlayerDataResetKind,
    {
      readonly action: string
      readonly title: string
      readonly paragraphs: readonly string[]
    }
  >
>

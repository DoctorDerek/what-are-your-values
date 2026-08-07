import { describe, expect, it } from "vitest"
import {
  playerDataResetBackupReadyNotice,
  playerDataResetCopy,
} from "./PlayerDataResetCopy"

describe("Player Data Reset Copy", () => {
  it("defines one exact scope-specific contract for every destructive action", () => {
    expect(Object.keys(playerDataResetCopy)).toEqual([
      "delete-all-custom-values",
      "reset-levels-and-experience",
      "reset-achievements",
      "delete-all-data",
    ])
    expect(
      playerDataResetCopy["delete-all-custom-values"].confirmationBody,
    ).toContain(
      "This cannot be undone after you confirm. Export your data first if you may want it later.",
    )
    expect(
      playerDataResetCopy["reset-levels-and-experience"].confirmationBody,
    ).toContain(
      "It advances the internal progress generation so restored scheduler state cannot cross the reset boundary. Your current value ranking restarts from an all-tied baseline.",
    )
    expect(
      playerDataResetCopy["reset-achievements"].confirmationBody,
    ).toContain(
      "After reset, threshold achievements respond to future qualifying events; a threshold already satisfied does not silently unlock again without a new qualifying event. Use Reset Levels & Experience too if you want to replay level thresholds from the beginning.",
    )
    expect(playerDataResetCopy["delete-all-data"].confirmationBody).toContain(
      "You will return to Introduction. This does not uninstall the app or remove the offline program files needed to open it. This cannot be undone. Export your data first if you may want it later.",
    )
    expect(playerDataResetBackupReadyNotice).toBe(
      "Your private backup is ready. Review the reset when you are ready.",
    )
  })
})

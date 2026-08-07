import { describe, expect, it } from "vitest"
import { playerDataRecoveryCopy } from "./PlayerDataRecoveryCopy"

describe("Player Data Recovery Copy", () => {
  it("freezes the exact unreadable-save and storage-unavailable contracts", () => {
    expect(playerDataRecoveryCopy.loading).toBe("Loading your values…")
    expect(playerDataRecoveryCopy.unreadableData.body).toEqual([
      "WAYVM could not safely load the current save on this device. Nothing has been erased.",
      "You can restore the last known-good save, import another backup, download the unreadable data for recovery, or choose Delete All Data.",
    ])
    expect(playerDataRecoveryCopy.unreadableData.restoreConfirmation).toBe(
      "Restore the last known-good save? The unreadable current save will be preserved until restoration succeeds.",
    )
    expect(playerDataRecoveryCopy.unreadableData.noKnownGoodSave).toBe(
      "No last known-good save is available. You can import a backup, export the unreadable data, or choose Delete All Data.",
    )
    expect(playerDataRecoveryCopy.storageUnavailable.title).toBe(
      "Progress Cannot Be Saved Reliably",
    )
    expect(playerDataRecoveryCopy.actions).toEqual({
      restoreLastKnownGoodSave: "Restore Last Known-Good Save",
      importBackup: "Import Backup",
      exportUnreadableData: "Export Unreadable Data",
      deleteAllData: "Delete All Data",
      exportCurrentData: "Export Current Data",
      tryAgain: "Try Again",
      returnWithoutNewChanges: "Return Without New Changes",
    })
  })
})

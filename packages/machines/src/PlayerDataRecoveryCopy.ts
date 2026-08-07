type RecoveryActionCopy = {
  readonly restoreLastKnownGoodSave: string
  readonly importBackup: string
  readonly exportUnreadableData: string
  readonly deleteAllData: string
  readonly exportCurrentData: string
  readonly tryAgain: string
  readonly returnWithoutNewChanges: string
}

export const playerDataRecoveryCopy = Object.freeze({
  unreadableData: Object.freeze({
    title: "Your Saved Data Needs Attention",
    body: Object.freeze([
      "WAYVM could not safely load the current save on this device. Nothing has been erased.",
      "You can restore the last known-good save, import another backup, download the unreadable data for recovery, or choose Delete All Data.",
    ] as const),
    restoreConfirmation:
      "Restore the last known-good save? The unreadable current save will be preserved until restoration succeeds.",
    restoreSuccess: "Last known-good save restored.",
    selectedBackupSuccess:
      "Your backup replaced the unreadable local data.",
    noKnownGoodSave:
      "No last known-good save is available. You can import a backup, export the unreadable data, or choose Delete All Data.",
    diagnosticReady:
      "Your unreadable local data is ready as a diagnostic recovery file.",
  } as const),
  storageUnavailable: Object.freeze({
    title: "Progress Cannot Be Saved Reliably",
    body: "WAYVM cannot currently write to device storage. Keep this screen open while you export a backup or free storage. Continuing without a reliable save could lose new progress.",
    currentBackupReady: "Your current data backup is ready.",
  } as const),
  actions: Object.freeze({
    restoreLastKnownGoodSave: "Restore Last Known-Good Save",
    importBackup: "Import Backup",
    exportUnreadableData: "Export Unreadable Data",
    deleteAllData: "Delete All Data",
    exportCurrentData: "Export Current Data",
    tryAgain: "Try Again",
    returnWithoutNewChanges: "Return Without New Changes",
  } as const satisfies RecoveryActionCopy),
} as const)

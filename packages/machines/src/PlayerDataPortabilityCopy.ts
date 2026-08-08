import { getErrorMessage } from "@game/utils/src/Errors"
import { BATTLE_PROFILE_CHECKPOINT_SCHEMA_VERSION } from "./BattleProfileCheckpoint"
import { WAYVM_EXPORT_FORMAT_VERSION } from "./WayvmExport"

export const playerDataPortabilityCopy = Object.freeze({
  screenTitle: "Import & Export",
  introduction:
    "Your progress, Custom Values, achievements, language, and settings are stored on this device. Export a JSON backup to keep a portable copy or move your data between supported WAYVM apps.",
  exportTitle: "Export Data",
  exportDescription:
    "Save a versioned JSON backup of your progress, Custom Values, achievements, language, settings, and other portable WAYVM data. Exporting does not upload your data to us.",
  exportAction: "Export Data",
  exportSuccess: "Your WAYVM backup is ready.",
  exportFailure:
    "WAYVM could not create a backup. Your saved data was not changed. Please try again or check available device storage.",
  importTitle: "Import Data",
  importDescription:
    "Choose a WAYVM JSON backup. The app will validate it and show you a preview before replacing data on this device.",
  chooseBackupAction: "Choose Backup",
  importPreviewTitle: "Review Import",
  importPreviewWarning:
    "Importing this backup will replace the current WAYVM data on this device. A local safety backup will be created first.",
  importCancelAction: "Cancel",
  importReplaceAction: "Import & Replace",
  importCancelled: "Import cancelled. Your data was not changed.",
  importSuccess: "Backup restored. Your imported progress is ready.",
  importInvalid:
    "This file is not a valid WAYVM backup. Your data was not changed.",
  importNewer:
    "This backup was created by a newer version of WAYVM and cannot be opened safely here. Update the app and try again. Your data was not changed.",
  importUnsupported:
    "This backup uses a format version WAYVM cannot open safely. Your data was not changed.",
  importUnsafe:
    "This backup is too large or contains data WAYVM cannot process safely. Your data was not changed.",
  importRestoreFailure:
    "WAYVM could not restore this backup. Your saved data was not changed. Please try again.",
})

const unsupportedVersionPattern =
  /^Unsupported (export format|save schema) version: (\d+)$/u

function isUnsafeImportIssue(issue: string) {
  return (
    issue.startsWith("Persisted JSON exceeds") ||
    issue === "Persisted JSON contains an unsafe number"
  )
}

export function getWayvmImportValidationIssue(error: unknown) {
  const issue = getErrorMessage(error)
  const unsupportedVersion = unsupportedVersionPattern.exec(issue)

  if (unsupportedVersion) {
    const candidateVersion = Number(unsupportedVersion[2])
    const supportedVersion =
      unsupportedVersion[1] === "export format"
        ? WAYVM_EXPORT_FORMAT_VERSION
        : BATTLE_PROFILE_CHECKPOINT_SCHEMA_VERSION

    return candidateVersion > supportedVersion
      ? playerDataPortabilityCopy.importNewer
      : playerDataPortabilityCopy.importUnsupported
  }

  if (issue.startsWith("Unsupported"))
    return playerDataPortabilityCopy.importUnsupported

  if (isUnsafeImportIssue(issue)) return playerDataPortabilityCopy.importUnsafe

  return playerDataPortabilityCopy.importInvalid
}

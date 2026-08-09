export type NativePlayerDataFileDestination = "data-management" | "recovery"

export function createNativePlayerDataFileReadStartedEvent(
  destination: NativePlayerDataFileDestination,
) {
  return destination === "data-management"
    ? ({ type: "DATA_MANAGEMENT.IMPORT_FILE_READ_REQUESTED" } as const)
    : null
}

export function createNativePlayerDataImportPreparedEvent(
  destination: NativePlayerDataFileDestination,
  serialized: string,
) {
  return destination === "data-management"
    ? ({
        type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
        serialized,
      } as const)
    : ({ type: "RECOVERY.IMPORT_PREPARE_REQUESTED", serialized } as const)
}

export function createNativePlayerDataFileFailureEvent(
  destination: NativePlayerDataFileDestination,
  issue: string,
) {
  return destination === "data-management"
    ? ({ type: "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED", issue } as const)
    : ({ type: "RECOVERY.PLATFORM_FAILURE_REPORTED", issue } as const)
}

export function createNativePlayerDataExportConsumedEvent(
  destination: NativePlayerDataFileDestination,
) {
  return destination === "data-management"
    ? ({ type: "DATA_MANAGEMENT.EXPORT_CONSUMED" } as const)
    : ({ type: "RECOVERY.EXPORT_CONSUMED" } as const)
}

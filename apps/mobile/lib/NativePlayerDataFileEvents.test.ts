import { describe, expect, it } from "vitest"
import {
  createNativePlayerDataExportConsumedEvent,
  createNativePlayerDataFileFailureEvent,
  createNativePlayerDataFileReadStartedEvent,
  createNativePlayerDataImportPreparedEvent,
} from "./NativePlayerDataFileEvents"

describe("native player-data file events", () => {
  it("clears ordinary import feedback before opening the picker", () => {
    expect(
      createNativePlayerDataFileReadStartedEvent("data-management"),
    ).toEqual({ type: "DATA_MANAGEMENT.IMPORT_FILE_READ_REQUESTED" })
    expect(createNativePlayerDataFileReadStartedEvent("recovery")).toBeNull()
  })

  it("routes selected backup bytes to the active destination", () => {
    expect(
      createNativePlayerDataImportPreparedEvent("data-management", "backup"),
    ).toEqual({
      type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
      serialized: "backup",
    })
    expect(
      createNativePlayerDataImportPreparedEvent("recovery", "evidence"),
    ).toEqual({
      type: "RECOVERY.IMPORT_PREPARE_REQUESTED",
      serialized: "evidence",
    })
  })

  it("reports platform failures to the active destination", () => {
    expect(
      createNativePlayerDataFileFailureEvent("data-management", "Unavailable"),
    ).toEqual({
      type: "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED",
      issue: "Unavailable",
    })
    expect(
      createNativePlayerDataFileFailureEvent("recovery", "Unreadable"),
    ).toEqual({
      type: "RECOVERY.PLATFORM_FAILURE_REPORTED",
      issue: "Unreadable",
    })
  })

  it("acknowledges exports through the active destination", () => {
    expect(
      createNativePlayerDataExportConsumedEvent("data-management"),
    ).toEqual({ type: "DATA_MANAGEMENT.EXPORT_CONSUMED" })
    expect(createNativePlayerDataExportConsumedEvent("recovery")).toEqual({
      type: "RECOVERY.EXPORT_CONSUMED",
    })
  })
})

import { describe, expect, it } from "vitest"
import {
  getWayvmImportValidationIssue,
  playerDataPortabilityCopy,
} from "./PlayerDataPortabilityCopy"

describe("Player Data Portability Copy", () => {
  it.each([
    "Persisted JSON is malformed",
    "Export content hash does not match",
    "Export identity does not match its player data",
  ])("presents invalid backup failures without parser detail", (issue) => {
    expect(getWayvmImportValidationIssue(new Error(issue))).toBe(
      playerDataPortabilityCopy.importInvalid,
    )
  })

  it.each([
    "Persisted JSON exceeds its byte limit",
    "Persisted JSON exceeds its structural depth limit",
    "Persisted JSON exceeds its container node limit",
    "Persisted JSON contains an unsafe number",
  ])("presents unsafe backup failures without limit detail", (issue) => {
    expect(getWayvmImportValidationIssue(new Error(issue))).toBe(
      playerDataPortabilityCopy.importUnsafe,
    )
  })

  it.each([
    "Unsupported export format: another-app",
    "Unsupported export format version: 0",
    "Unsupported save schema version: 0",
    "Unsupported canonical catalog version: legacy-catalog",
  ])("presents older or incompatible formats as unsupported", (issue) => {
    expect(getWayvmImportValidationIssue(new Error(issue))).toBe(
      playerDataPortabilityCopy.importUnsupported,
    )
  })

  it.each([
    "Unsupported export format version: 2",
    "Unsupported save schema version: 2",
  ])("identifies a newer supported-contract version", (issue) => {
    expect(getWayvmImportValidationIssue(new Error(issue))).toBe(
      playerDataPortabilityCopy.importNewer,
    )
  })

  it("normalizes non-Error validation failures", () => {
    expect(getWayvmImportValidationIssue("malformed")).toBe(
      playerDataPortabilityCopy.importInvalid,
    )
  })
})

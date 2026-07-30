import { readIsoTimestamp, readString } from "./PersistenceValidation"
import type { PreparedWayvmDownload } from "./PlayerDataPortabilityActors"
import { createSha256Hex } from "./Sha256"

export const WAYVM_RECOVERY_BUNDLE_FORMAT = "wayvm-recovery-bundle" as const
export const WAYVM_RECOVERY_BUNDLE_VERSION = 1 as const

type RecoveryBundleEntry = readonly [key: string, value: string]

function readRequiredRecoveryMetadata(value: unknown, label: string) {
  const metadata = readString(value, label)
  if (metadata.length === 0) {
    throw new Error(`${label} is required`)
  }

  return metadata
}

function createRecoveryBundleEntries(
  entries: ReadonlyMap<string, string>,
): readonly RecoveryBundleEntry[] {
  return Object.freeze(
    Array.from(entries)
      .map(([key, value]) => {
        if (key.length === 0) {
          throw new Error("Recovery bundle contains an empty storage key")
        }

        return Object.freeze([key, value]) satisfies RecoveryBundleEntry
      })
      .sort(([firstKey], [secondKey]) =>
        firstKey < secondKey ? -1 : firstKey > secondKey ? 1 : 0,
      ),
  )
}

export async function createBattleProfileRecoveryBundle({
  entries,
  exportedAt,
  issue,
  sourceAppVersion,
  sourceBuild,
}: {
  readonly entries: ReadonlyMap<string, string>
  readonly exportedAt: string
  readonly issue: string
  readonly sourceAppVersion: string
  readonly sourceBuild: string
}): Promise<PreparedWayvmDownload> {
  const timestamp = readIsoTimestamp(exportedAt, "Recovery export timestamp")
  const recoveryIssue = readRequiredRecoveryMetadata(issue, "Recovery issue")
  const hashableBundle = [
    WAYVM_RECOVERY_BUNDLE_FORMAT,
    WAYVM_RECOVERY_BUNDLE_VERSION,
    timestamp,
    readRequiredRecoveryMetadata(
      sourceAppVersion,
      "Recovery source application version",
    ),
    readRequiredRecoveryMetadata(sourceBuild, "Recovery source build"),
    recoveryIssue,
    createRecoveryBundleEntries(entries),
  ] as const
  const hashableBytes = JSON.stringify(hashableBundle)
  const contentHash = await createSha256Hex(hashableBytes)

  return Object.freeze({
    filename: `what-are-your-values-mapache-recovery-${timestamp
      .replace("T", "-")
      .replaceAll(":", "")
      .replace(/\.\d{3}Z$/u, "Z")}.json`,
    serialized: JSON.stringify([...hashableBundle, contentHash]),
  })
}

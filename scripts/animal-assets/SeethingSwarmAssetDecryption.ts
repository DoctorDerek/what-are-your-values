import { access } from "node:fs/promises"
import { extractSeethingSwarmArchive } from "./SeethingSwarmArchiveExtractor"
import {
  getSeethingSwarmAssetCustodyPaths,
  getSeethingSwarmAssetKey,
  SEETHING_SWARM_ARCHIVE_FILE_NAME,
  SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME,
  type SeethingSwarmAssetEnvironment,
} from "./SeethingSwarmAssetCustody"

type RunSeethingSwarmAssetDecryptionOptions = {
  environment?: SeethingSwarmAssetEnvironment
  repositoryRoot?: string
  writeStatus?: (message: string) => unknown
}

async function archiveExists(archivePath: string) {
  try {
    await access(archivePath)
    return true
  } catch {
    return false
  }
}

export async function runSeethingSwarmAssetDecryption({
  environment = process.env,
  repositoryRoot = process.cwd(),
  writeStatus = (message) => process.stdout.write(message),
}: RunSeethingSwarmAssetDecryptionOptions = {}) {
  const assetKey = getSeethingSwarmAssetKey(environment)

  if (!assetKey) {
    writeStatus(
      `${SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME} is not set; continuing without protected archive extraction.\n`,
    )
    return Object.freeze({ mode: "unkeyed" as const })
  }

  const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
  if (!(await archiveExists(paths.archivePath)))
    throw new Error(
      `${SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME} is set, but ${SEETHING_SWARM_ARCHIVE_FILE_NAME} is missing.`,
    )

  try {
    await extractSeethingSwarmArchive({
      archivePath: paths.archivePath,
      assetKey,
      custodyDirectory: paths.custodyDirectory,
      vendorDirectory: paths.vendorDirectory,
    })
  } catch {
    throw new Error(
      "SeethingSwarm asset extraction failed; verify the encrypted archive and its protected key.",
    )
  }

  writeStatus("Extracted the authorized SeethingSwarm asset archive.\n")
  return Object.freeze({ mode: "licensed" as const })
}

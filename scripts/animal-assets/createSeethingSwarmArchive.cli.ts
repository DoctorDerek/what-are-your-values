import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createSeethingSwarmArchive } from "./SeethingSwarmArchiveCreator"
import {
  getSeethingSwarmAssetCustodyPaths,
  getSeethingSwarmAssetKey,
  SEETHING_SWARM_ARCHIVE_FILE_NAME,
  SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME,
  type SeethingSwarmAssetEnvironment,
} from "./SeethingSwarmAssetCustody"

type RunSeethingSwarmArchiveCreatorCliOptions = {
  environment?: SeethingSwarmAssetEnvironment
  repositoryRoot?: string
  writeStatus?: (message: string) => unknown
}

export async function runSeethingSwarmArchiveCreatorCli({
  environment = process.env,
  repositoryRoot = process.cwd(),
  writeStatus = (message) => process.stdout.write(message),
}: RunSeethingSwarmArchiveCreatorCliOptions = {}) {
  const assetKey = getSeethingSwarmAssetKey(environment)
  if (!assetKey)
    throw new Error(
      `${SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME} is required to create the protected archive.`,
    )

  const paths = getSeethingSwarmAssetCustodyPaths(repositoryRoot)
  const result = await createSeethingSwarmArchive({
    archivePath: paths.archivePath,
    assetKey,
    custodyDirectory: paths.custodyDirectory,
  })
  writeStatus(
    `Created and verified ${SEETHING_SWARM_ARCHIVE_FILE_NAME} with ${result.fileCount} licensed custody files.\n`,
  )
  return result
}

const directEntryPath = process.argv[2] ? resolve(process.argv[2]) : ""
if (directEntryPath === fileURLToPath(import.meta.url))
  await runSeethingSwarmArchiveCreatorCli()

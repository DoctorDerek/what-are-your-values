import { execFileSync } from "node:child_process"
import { mkdirSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const GHOST_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME =
  "GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE"
const repositoryRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
)
const ghostAssetsDirectory = join(repositoryRootDirectory, "ghost_assets")
const vendorDirectory = join(repositoryRootDirectory, "vendor")
const ghostAssetKey = process.env[GHOST_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME]

if (!ghostAssetKey) {
  process.stdout.write(
    `${GHOST_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME} is not set; skipping encrypted asset extraction.\n`,
  )
} else {
  const encryptedArchiveFilePaths = readdirSync(ghostAssetsDirectory, {
    withFileTypes: true,
  })
    .filter(
      (directoryEntry) =>
        directoryEntry.isFile() &&
        directoryEntry.name.toLowerCase().endsWith(".zip"),
    )
    .map((directoryEntry) => join(ghostAssetsDirectory, directoryEntry.name))
    .sort()

  if (encryptedArchiveFilePaths.length === 0) {
    process.stderr.write(
      `${GHOST_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME} is set, but ghost_assets contains no encrypted ZIP archives.\n`,
    )
    process.exitCode = 1
  } else {
    mkdirSync(vendorDirectory, { recursive: true })

    try {
      for (const encryptedArchiveFilePath of encryptedArchiveFilePaths) {
        execFileSync(
          "unzip",
          [
            "-o",
            "-q",
            "-P",
            ghostAssetKey,
            encryptedArchiveFilePath,
            "-d",
            vendorDirectory,
          ],
          { stdio: "inherit" },
        )
      }

      process.stdout.write(
        `Extracted ${encryptedArchiveFilePaths.length} authorized ghost asset archive(s).\n`,
      )
    } catch {
      process.stderr.write(
        "Ghost asset extraction failed; verify the decryption key, encrypted archives, and unzip availability.\n",
      )
      process.exitCode = 1
    }
  }
}

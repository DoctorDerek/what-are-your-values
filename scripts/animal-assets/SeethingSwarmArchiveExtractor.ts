import { randomUUID } from "node:crypto"
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import { dirname, resolve } from "node:path"
import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
} from "@zip.js/zip.js/index-native.js"
import { resolveSeethingSwarmArchiveOutputPath } from "./SeethingSwarmArchiveEntry"
import {
  SEETHING_SWARM_ARCHIVE_ENTRY_ROOT,
  SEETHING_SWARM_ARCHIVE_LIMITS,
  SEETHING_SWARM_REQUIRED_ARCHIVE_ENTRY_NAMES,
} from "./SeethingSwarmAssetCustody"

type ExtractSeethingSwarmArchiveOptions = {
  archivePath: string
  assetKey: string
  custodyDirectory: string
  vendorDirectory: string
}

async function pathExists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function replaceCustodyDirectory(
  stagedCustodyDirectory: string,
  custodyDirectory: string,
  vendorDirectory: string,
) {
  const backupDirectory = resolve(
    vendorDirectory,
    `.seethingswarm-backup-${randomUUID()}`,
  )
  const existingCustodyDirectory = await pathExists(custodyDirectory)

  if (existingCustodyDirectory) await rename(custodyDirectory, backupDirectory)

  try {
    await rename(stagedCustodyDirectory, custodyDirectory)
  } catch (error: unknown) {
    if (existingCustodyDirectory && !(await pathExists(custodyDirectory)))
      await rename(backupDirectory, custodyDirectory)
    throw error
  }

  if (existingCustodyDirectory)
    await rm(backupDirectory, { force: true, recursive: true })
}

export async function extractSeethingSwarmArchive({
  archivePath,
  assetKey,
  custodyDirectory,
  vendorDirectory,
}: ExtractSeethingSwarmArchiveOptions) {
  const archiveData = await readFile(archivePath)
  await mkdir(vendorDirectory, { recursive: true })
  const extractionDirectory = await mkdtemp(
    resolve(vendorDirectory, ".seethingswarm-extract-"),
  )

  try {
    const zipReader = new ZipReader(new Uint8ArrayReader(archiveData), {
      filenameValidation: "strict",
      strictness: "strict",
      useWebWorkers: false,
    })

    try {
      const entries = await zipReader.getEntries({
        filenameValidation: "strict",
        strictness: "strict",
      })

      if (
        entries.length === 0 ||
        entries.length > SEETHING_SWARM_ARCHIVE_LIMITS.maximumEntryCount
      )
        throw new Error("Archive contains an invalid custody entry count.")

      const normalizedEntryNames = new Set<string>()
      let totalUncompressedSize = 0

      for (const entry of entries) {
        if (
          entry.directory ||
          entry.symlink ||
          !entry.encrypted ||
          entry.zipCrypto
        )
          throw new Error("Archive contains an invalid custody entry type.")

        if (
          entry.uncompressedSize >
          SEETHING_SWARM_ARCHIVE_LIMITS.maximumEntrySizeBytes
        )
          throw new Error("Archive custody entry exceeds its size limit.")

        totalUncompressedSize += entry.uncompressedSize
        if (
          totalUncompressedSize >
          SEETHING_SWARM_ARCHIVE_LIMITS.maximumTotalSizeBytes
        )
          throw new Error("Archive custody payload exceeds its size limit.")

        const normalizedEntryName = entry.filename.toLowerCase()
        if (normalizedEntryNames.has(normalizedEntryName))
          throw new Error("Archive contains ambiguous custody entry names.")
        normalizedEntryNames.add(normalizedEntryName)

        const outputPath = resolveSeethingSwarmArchiveOutputPath(
          extractionDirectory,
          entry.filename,
        )
        const entryData = await entry.getData(new Uint8ArrayWriter(), {
          checkAuthenticationCode: true,
          checkCrc32: true,
          password: assetKey,
          strictness: "strict",
          useWebWorkers: false,
        })

        await mkdir(dirname(outputPath), { recursive: true })
        await writeFile(outputPath, entryData, { flag: "wx" })
      }

      for (const requiredEntryName of SEETHING_SWARM_REQUIRED_ARCHIVE_ENTRY_NAMES) {
        if (!normalizedEntryNames.has(requiredEntryName.toLowerCase()))
          throw new Error("Archive is missing required custody entries.")
      }

      await replaceCustodyDirectory(
        resolve(extractionDirectory, SEETHING_SWARM_ARCHIVE_ENTRY_ROOT),
        custodyDirectory,
        vendorDirectory,
      )
    } finally {
      await zipReader.close()
    }
  } finally {
    await rm(extractionDirectory, { force: true, recursive: true })
  }
}

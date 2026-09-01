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
import { dirname, relative, resolve, sep } from "node:path"
import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
} from "@zip.js/zip.js/index-native.js"
import {
  SEETHING_SWARM_ARCHIVE_ENTRY_ROOT,
  SEETHING_SWARM_REQUIRED_ARCHIVE_ENTRY_NAMES,
} from "./SeethingSwarmAssetCustody"

const MAXIMUM_ARCHIVE_ENTRY_COUNT = 2_048
const MAXIMUM_ARCHIVE_ENTRY_SIZE_BYTES = 16 * 1_024 * 1_024
const MAXIMUM_ARCHIVE_TOTAL_SIZE_BYTES = 64 * 1_024 * 1_024
const SAFE_ARCHIVE_ENTRY_NAME_PATTERN = /^[A-Za-z0-9._/-]+$/

type ExtractSeethingSwarmArchiveOptions = {
  archivePath: string
  assetKey: string
  custodyDirectory: string
  vendorDirectory: string
}

function resolveArchiveOutputPath(
  extractionDirectory: string,
  entryName: string,
) {
  const expectedPrefix = `${SEETHING_SWARM_ARCHIVE_ENTRY_ROOT}/`
  const entryPathSegments = entryName.split("/")

  if (
    !entryName.startsWith(expectedPrefix) ||
    entryName.includes("\\") ||
    !SAFE_ARCHIVE_ENTRY_NAME_PATTERN.test(entryName) ||
    entryPathSegments.some(
      (entryPathSegment) =>
        entryPathSegment === "" ||
        entryPathSegment === "." ||
        entryPathSegment === "..",
    )
  )
    throw new Error("Archive contains an unsafe custody entry name.")

  const resolvedExtractionDirectory = resolve(extractionDirectory)
  const outputPath = resolve(resolvedExtractionDirectory, ...entryPathSegments)
  const relativeOutputPath = relative(resolvedExtractionDirectory, outputPath)

  if (relativeOutputPath === ".." || relativeOutputPath.startsWith(`..${sep}`))
    throw new Error("Archive entry resolves outside its custody boundary.")

  return outputPath
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

      if (entries.length === 0 || entries.length > MAXIMUM_ARCHIVE_ENTRY_COUNT)
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

        if (entry.uncompressedSize > MAXIMUM_ARCHIVE_ENTRY_SIZE_BYTES)
          throw new Error("Archive custody entry exceeds its size limit.")

        totalUncompressedSize += entry.uncompressedSize
        if (totalUncompressedSize > MAXIMUM_ARCHIVE_TOTAL_SIZE_BYTES)
          throw new Error("Archive custody payload exceeds its size limit.")

        const normalizedEntryName = entry.filename.toLowerCase()
        if (normalizedEntryNames.has(normalizedEntryName))
          throw new Error("Archive contains ambiguous custody entry names.")
        normalizedEntryNames.add(normalizedEntryName)

        const outputPath = resolveArchiveOutputPath(
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

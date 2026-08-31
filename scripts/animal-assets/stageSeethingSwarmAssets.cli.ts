import { randomUUID } from "node:crypto"
import { rm, writeFile } from "node:fs/promises"
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path"
import { fileURLToPath } from "node:url"
import { createSeethingSwarmLicensedStaticAssetAdapter } from "#game/data/src/SeethingSwarmStaticAssetAdapter"
import {
  createSeethingSwarmAssetReceipt,
  serializeSeethingSwarmAssetReceipt,
} from "./SeethingSwarmAssetReceipt"
import {
  publishSeethingSwarmPreparedAssetTree,
  stageSeethingSwarmAssets,
} from "./SeethingSwarmAssetStager"
import { generateSeethingSwarmNativeAssetModule } from "./SeethingSwarmNativeAssetModuleGenerator"
import { sanitizeSeethingSwarmPrivateSourceError } from "./SeethingSwarmPrivatePathSanitizer"
import { generateSeethingSwarmAnimalRegistry } from "./SeethingSwarmRegistryGenerator"
import { validateSeethingSwarmSnapshot } from "./SeethingSwarmSnapshotValidator"
import { generateSeethingSwarmWebAssetModule } from "./SeethingSwarmWebAssetModuleGenerator"

const DEFAULT_OUTPUT_PATH = "vendor/seethingswarm/assets"

export const SEETHING_SWARM_PRIVATE_OUTPUT_FILES = Object.freeze({
  webModule: "SeethingSwarmWebStaticAssets.ts",
  nativeModule: "SeethingSwarmNativeStaticAssets.ts",
  receipt: "staging-receipt.json",
})

export type SeethingSwarmStagingCliOptions = Readonly<{
  sourceRoot: string
  outputPath: string
}>

function readOptionValue(arguments_: readonly string[], index: number) {
  const value = arguments_[index + 1]
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${arguments_[index]}`)
  }
  return value
}

export function parseSeethingSwarmStagingCliArguments(
  arguments_: readonly string[],
) {
  let sourceRoot: string | undefined
  let outputPath = DEFAULT_OUTPUT_PATH
  let outputPathWasSupplied = false

  for (let index = 0; index < arguments_.length; index += 2) {
    const option = arguments_[index]
    const value = readOptionValue(arguments_, index)

    if (option === "--source-root") {
      if (sourceRoot) throw new Error("Duplicate --source-root option")
      sourceRoot = value
    } else if (option === "--output") {
      if (outputPathWasSupplied) throw new Error("Duplicate --output option")
      outputPath = value
      outputPathWasSupplied = true
    } else {
      throw new Error(`Unknown SeethingSwarm staging option: ${option}`)
    }
  }

  if (!sourceRoot) throw new Error("Missing required --source-root option")

  return Object.freeze({
    sourceRoot,
    outputPath,
  }) satisfies SeethingSwarmStagingCliOptions
}

export function resolveSeethingSwarmStagingOutputPath(
  repositoryRoot: string,
  requestedOutputPath: string,
) {
  const vendorRoot = resolve(repositoryRoot, "vendor", "seethingswarm")
  const outputRoot = resolve(repositoryRoot, requestedOutputPath)
  const relativeVendorPath = relative(vendorRoot, outputRoot)
  if (
    relativeVendorPath === "" ||
    relativeVendorPath === ".." ||
    relativeVendorPath.startsWith(`..${sep}`) ||
    isAbsolute(relativeVendorPath)
  ) {
    throw new Error(
      "SeethingSwarm staging output must be beneath vendor/seethingswarm/",
    )
  }

  return outputRoot
}

async function writePreparedOutputFiles(
  preparedRoot: string,
  webModuleSource: string,
  nativeModuleSource: string,
  serializedReceipt: string,
) {
  await Promise.all([
    writeFile(
      resolve(preparedRoot, SEETHING_SWARM_PRIVATE_OUTPUT_FILES.webModule),
      webModuleSource,
      { encoding: "utf8", flag: "wx" },
    ),
    writeFile(
      resolve(preparedRoot, SEETHING_SWARM_PRIVATE_OUTPUT_FILES.nativeModule),
      nativeModuleSource,
      { encoding: "utf8", flag: "wx" },
    ),
    writeFile(
      resolve(preparedRoot, SEETHING_SWARM_PRIVATE_OUTPUT_FILES.receipt),
      serializedReceipt,
      { encoding: "utf8", flag: "wx" },
    ),
  ])
}

export async function runSeethingSwarmStagingCli(
  arguments_: readonly string[],
  repositoryRoot = process.cwd(),
  writeStatus: (message: string) => unknown = (message) =>
    process.stdout.write(message),
) {
  const options = parseSeethingSwarmStagingCliArguments(arguments_)
  const outputRoot = resolveSeethingSwarmStagingOutputPath(
    repositoryRoot,
    options.outputPath,
  )
  const preparedRoot = resolve(
    dirname(outputRoot),
    `.${basename(outputRoot)}.${randomUUID()}.prepared`,
  )

  try {
    const snapshot = await validateSeethingSwarmSnapshot(options.sourceRoot)
    const generatedRegistry = generateSeethingSwarmAnimalRegistry(snapshot)
    const staging = await stageSeethingSwarmAssets(
      options.sourceRoot,
      preparedRoot,
      snapshot,
    )
    const licensedAdapter = createSeethingSwarmLicensedStaticAssetAdapter(
      generatedRegistry.registry,
      staging.assets.map(({ relativePath }) =>
        Object.freeze({ relativePath, asset: relativePath }),
      ),
    )
    const webModuleSource = generateSeethingSwarmWebAssetModule(staging)
    const nativeModuleSource = generateSeethingSwarmNativeAssetModule(staging)
    const receipt = await createSeethingSwarmAssetReceipt(
      preparedRoot,
      staging,
      webModuleSource,
      nativeModuleSource,
    )
    await writePreparedOutputFiles(
      preparedRoot,
      webModuleSource,
      nativeModuleSource,
      serializeSeethingSwarmAssetReceipt(receipt),
    )
    await publishSeethingSwarmPreparedAssetTree(preparedRoot, outputRoot)
    writeStatus(
      `Staged ${licensedAdapter.sources.length} verified SeethingSwarm assets totaling ${staging.totalBytes} bytes for static web and native bundlers.\n`,
    )

    return Object.freeze({
      assetCount: licensedAdapter.sources.length,
      totalBytes: staging.totalBytes,
      aggregateSha256: receipt.aggregateSha256,
    })
  } catch (error: unknown) {
    await rm(preparedRoot, { recursive: true, force: true })
    throw sanitizeSeethingSwarmPrivateSourceError(
      error,
      options.sourceRoot,
      "asset staging",
    )
  }
}

const directEntryPath = process.argv[2] ? resolve(process.argv[2]) : ""
if (directEntryPath === fileURLToPath(import.meta.url)) {
  await runSeethingSwarmStagingCli(process.argv.slice(3))
}

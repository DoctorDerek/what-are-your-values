import { randomUUID } from "node:crypto"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path"
import { fileURLToPath } from "node:url"
import { sanitizeSeethingSwarmPrivateSourceError } from "./SeethingSwarmPrivatePathSanitizer"
import { generateSeethingSwarmAnimalRegistry } from "./SeethingSwarmRegistryGenerator"
import { validateSeethingSwarmSnapshot } from "./SeethingSwarmSnapshotValidator"

const DEFAULT_OUTPUT_PATH = "vendor/seethingswarm/registry.json"

export type SeethingSwarmRegistryCliOptions = Readonly<{
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

export function parseSeethingSwarmRegistryCliArguments(
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
      throw new Error(`Unknown SeethingSwarm registry option: ${option}`)
    }
  }

  if (!sourceRoot) throw new Error("Missing required --source-root option")

  return Object.freeze({
    sourceRoot,
    outputPath,
  }) satisfies SeethingSwarmRegistryCliOptions
}

export function resolveSeethingSwarmRegistryOutputPath(
  repositoryRoot: string,
  requestedOutputPath: string,
) {
  const vendorRoot = resolve(repositoryRoot, "vendor")
  const outputPath = resolve(repositoryRoot, requestedOutputPath)
  const relativeVendorPath = relative(vendorRoot, outputPath)
  if (
    relativeVendorPath === "" ||
    relativeVendorPath === ".." ||
    relativeVendorPath.startsWith(`..${sep}`) ||
    isAbsolute(relativeVendorPath) ||
    extname(outputPath).toLowerCase() !== ".json"
  ) {
    throw new Error(
      "SeethingSwarm registry output must be a JSON file beneath vendor/",
    )
  }

  return outputPath
}

export async function writeSeethingSwarmRegistryAtomically(
  repositoryRoot: string,
  requestedOutputPath: string,
  serializedRegistry: string,
) {
  const outputPath = resolveSeethingSwarmRegistryOutputPath(
    repositoryRoot,
    requestedOutputPath,
  )
  const outputDirectory = dirname(outputPath)
  const temporaryPath = resolve(
    outputDirectory,
    `.${basename(outputPath)}.${randomUUID()}.tmp`,
  )

  await mkdir(outputDirectory, { recursive: true })
  try {
    await writeFile(temporaryPath, serializedRegistry, {
      encoding: "utf8",
      flag: "wx",
    })
    await rename(temporaryPath, outputPath)
  } catch (error: unknown) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}

export async function runSeethingSwarmRegistryCli(
  arguments_: readonly string[],
  repositoryRoot = process.cwd(),
  writeStatus: (message: string) => unknown = (message) =>
    process.stdout.write(message),
) {
  const options = parseSeethingSwarmRegistryCliArguments(arguments_)

  try {
    const snapshot = await validateSeethingSwarmSnapshot(options.sourceRoot)
    const generated = generateSeethingSwarmAnimalRegistry(snapshot)
    await writeSeethingSwarmRegistryAtomically(
      repositoryRoot,
      options.outputPath,
      generated.serializedRegistry,
    )
    writeStatus(
      `Generated ${generated.registry.animals.length} animals, ${generated.registry.characterAnimationCount} character animations, and ${generated.registry.auxiliaryEffectCount} auxiliary effect.\n`,
    )

    return Object.freeze({
      animalCount: generated.registry.animals.length,
      characterAnimationCount: generated.registry.characterAnimationCount,
      auxiliaryEffectCount: generated.registry.auxiliaryEffectCount,
    })
  } catch (error: unknown) {
    throw sanitizeSeethingSwarmPrivateSourceError(
      error,
      options.sourceRoot,
      "registry generation",
    )
  }
}

const directEntryPath = process.argv[2] ? resolve(process.argv[2]) : ""
if (directEntryPath === fileURLToPath(import.meta.url)) {
  await runSeethingSwarmRegistryCli(process.argv.slice(3))
}

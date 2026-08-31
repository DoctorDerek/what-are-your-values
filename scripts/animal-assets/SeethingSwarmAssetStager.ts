import { createHash, randomUUID } from "node:crypto"
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises"
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path"
import type { SeethingSwarmValidatedSnapshot } from "./SeethingSwarmSnapshotValidator"

export type SeethingSwarmStagedAsset = Readonly<{
  relativePath: string
  byteLength: number
  sha256: string
}>

export type SeethingSwarmStagingResult = Readonly<{
  evidenceSnapshotId: string
  assets: readonly SeethingSwarmStagedAsset[]
  totalBytes: number
}>

function compareText(first: string, second: string) {
  if (first < second) return -1
  if (first > second) return 1
  return 0
}

function isPathOutsideRoot(root: string, candidate: string) {
  const relativePath = relative(root, candidate)
  return (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  )
}

function resolveConfinedPath(root: string, relativePath: string) {
  const absolutePath = resolve(root, ...relativePath.split("/"))
  if (isPathOutsideRoot(root, absolutePath)) {
    throw new Error(`Unsafe SeethingSwarm staging path: ${relativePath}`)
  }
  return absolutePath
}

function getStagedAssetPaths(snapshot: SeethingSwarmValidatedSnapshot) {
  const paths = [
    ...snapshot.characterAnimations.map(({ relativePath }) => relativePath),
    ...snapshot.auxiliaryEffects.map(({ relativePath }) => relativePath),
  ].toSorted(compareText)
  const comparablePaths = new Set<string>()
  for (const path of paths) {
    const comparablePath = path.toLowerCase()
    if (comparablePaths.has(comparablePath)) {
      throw new Error(`Duplicate SeethingSwarm staging path: ${path}`)
    }
    comparablePaths.add(comparablePath)
  }

  const excludedPath = snapshot.excludedAnimations.find(({ relativePath }) =>
    comparablePaths.has(relativePath.toLowerCase()),
  )
  if (excludedPath) {
    throw new Error(
      `Excluded SeethingSwarm asset entered staging: ${excludedPath.relativePath}`,
    )
  }

  return paths
}

async function pathExists(path: string) {
  try {
    await lstat(path)
    return true
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false
    }
    throw error
  }
}

async function copyVerifiedAsset(
  sourceRoot: string,
  temporaryRoot: string,
  relativePath: string,
) {
  const sourcePath = resolveConfinedPath(sourceRoot, relativePath)
  const sourceStats = await lstat(sourcePath)
  if (sourceStats.isSymbolicLink()) {
    throw new Error(`Unsupported SeethingSwarm symbolic link: ${relativePath}`)
  }
  if (!sourceStats.isFile()) {
    throw new Error(`SeethingSwarm asset is not a file: ${relativePath}`)
  }

  const destinationPath = resolveConfinedPath(temporaryRoot, relativePath)
  await mkdir(dirname(destinationPath), { recursive: true })
  await copyFile(sourcePath, destinationPath)
  const destinationStats = await stat(destinationPath)
  if (destinationStats.size !== sourceStats.size) {
    throw new Error(`Incomplete SeethingSwarm asset copy: ${relativePath}`)
  }

  const [sourceContents, destinationContents] = await Promise.all([
    readFile(sourcePath),
    readFile(destinationPath),
  ])
  const sourceHash = createHash("sha256").update(sourceContents).digest("hex")
  const destinationHash = createHash("sha256")
    .update(destinationContents)
    .digest("hex")
  if (sourceHash !== destinationHash) {
    throw new Error(`Altered SeethingSwarm asset copy: ${relativePath}`)
  }

  return Object.freeze({
    relativePath,
    byteLength: destinationStats.size,
    sha256: destinationHash,
  }) satisfies SeethingSwarmStagedAsset
}

async function replaceStagingTree(
  temporaryRoot: string,
  outputRoot: string,
  backupRoot: string,
) {
  const priorOutputExists = await pathExists(outputRoot)
  if (priorOutputExists) {
    const outputStats = await lstat(outputRoot)
    if (outputStats.isSymbolicLink() || !outputStats.isDirectory()) {
      throw new Error("SeethingSwarm staging output must be a real directory")
    }
    await rename(outputRoot, backupRoot)
  }

  try {
    await rename(temporaryRoot, outputRoot)
  } catch (error: unknown) {
    if (priorOutputExists && !(await pathExists(outputRoot))) {
      await rename(backupRoot, outputRoot)
    }
    throw error
  }

  if (priorOutputExists) {
    await rm(backupRoot, { recursive: true, force: true })
  }
}

function assertSeparateRoots(sourceRoot: string, outputRoot: string) {
  if (
    sourceRoot === outputRoot ||
    !isPathOutsideRoot(sourceRoot, outputRoot) ||
    !isPathOutsideRoot(outputRoot, sourceRoot)
  ) {
    throw new Error(
      "SeethingSwarm source and staging output must use separate trees",
    )
  }
}

export async function stageSeethingSwarmAssets(
  sourceRoot: string,
  outputRoot: string,
  snapshot: SeethingSwarmValidatedSnapshot,
) {
  const resolvedSourceRoot = resolve(sourceRoot)
  const resolvedOutputRoot = resolve(outputRoot)
  assertSeparateRoots(resolvedSourceRoot, resolvedOutputRoot)

  const outputParent = dirname(resolvedOutputRoot)
  const outputName = basename(resolvedOutputRoot)
  const stagingId = randomUUID()
  const temporaryRoot = resolve(
    outputParent,
    `.${outputName}.${stagingId}.temporary`,
  )
  const backupRoot = resolve(outputParent, `.${outputName}.${stagingId}.backup`)
  const assetPaths = getStagedAssetPaths(snapshot)

  await mkdir(outputParent, { recursive: true })
  await mkdir(temporaryRoot, { recursive: false })
  try {
    const assets: SeethingSwarmStagedAsset[] = []
    for (const relativePath of assetPaths) {
      assets.push(
        await copyVerifiedAsset(
          resolvedSourceRoot,
          temporaryRoot,
          relativePath,
        ),
      )
    }
    await replaceStagingTree(temporaryRoot, resolvedOutputRoot, backupRoot)

    return Object.freeze({
      evidenceSnapshotId: snapshot.evidenceSnapshotId,
      assets: Object.freeze(assets),
      totalBytes: assets.reduce(
        (totalBytes, asset) => totalBytes + asset.byteLength,
        0,
      ),
    }) satisfies SeethingSwarmStagingResult
  } catch (error: unknown) {
    await rm(temporaryRoot, { recursive: true, force: true })
    throw error
  }
}

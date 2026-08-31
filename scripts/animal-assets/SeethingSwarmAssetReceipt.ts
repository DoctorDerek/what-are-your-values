import { createHash } from "node:crypto"
import { lstat, readFile } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"
import type { SeethingSwarmStagingResult } from "./SeethingSwarmAssetStager"
import { assertSeethingSwarmStaticAssetModuleInputs } from "./SeethingSwarmStaticAssetModuleGenerator"

export const SEETHING_SWARM_ASSET_RECEIPT_SCHEMA_VERSION = 1

export type SeethingSwarmAssetReceiptEntry = Readonly<{
  relativePath: string
  byteLength: number
  sha256: string
}>

export type SeethingSwarmGeneratedModuleReceipt = Readonly<{
  byteLength: number
  sha256: string
}>

export type SeethingSwarmAssetReceipt = Readonly<{
  schemaVersion: typeof SEETHING_SWARM_ASSET_RECEIPT_SCHEMA_VERSION
  evidenceSnapshotId: string
  assetCount: number
  totalBytes: number
  assets: readonly SeethingSwarmAssetReceiptEntry[]
  generatedModules: Readonly<{
    web: SeethingSwarmGeneratedModuleReceipt
    native: SeethingSwarmGeneratedModuleReceipt
  }>
  aggregateSha256: string
}>

function sha256(contents: Uint8Array | string) {
  return createHash("sha256").update(contents).digest("hex")
}

function resolveStagedAssetPath(stagingRoot: string, relativePath: string) {
  const absolutePath = resolve(stagingRoot, ...relativePath.split("/"))
  const confinedRelativePath = relative(stagingRoot, absolutePath)
  if (
    confinedRelativePath === ".." ||
    confinedRelativePath.startsWith(`..${sep}`) ||
    isAbsolute(confinedRelativePath)
  ) {
    throw new Error(`Unsafe SeethingSwarm receipt path: ${relativePath}`)
  }
  return absolutePath
}

async function verifyStagedAsset(
  stagingRoot: string,
  expectedAsset: SeethingSwarmStagingResult["assets"][number],
) {
  const assetPath = resolveStagedAssetPath(
    stagingRoot,
    expectedAsset.relativePath,
  )
  const assetStats = await lstat(assetPath)
  if (assetStats.isSymbolicLink() || !assetStats.isFile()) {
    throw new Error(
      `Invalid SeethingSwarm staged receipt asset: ${expectedAsset.relativePath}`,
    )
  }

  const contents = await readFile(assetPath)
  const actualHash = sha256(contents)
  if (
    contents.byteLength !== expectedAsset.byteLength ||
    actualHash !== expectedAsset.sha256
  ) {
    throw new Error(
      `Altered SeethingSwarm staged receipt asset: ${expectedAsset.relativePath}`,
    )
  }

  return Object.freeze({
    relativePath: expectedAsset.relativePath,
    byteLength: contents.byteLength,
    sha256: actualHash,
  }) satisfies SeethingSwarmAssetReceiptEntry
}

function createGeneratedModuleReceipt(source: string, label: string) {
  if (source.trim() === "") {
    throw new Error(`Missing SeethingSwarm ${label} generated module`)
  }
  const contents = Buffer.from(source, "utf8")
  return Object.freeze({
    byteLength: contents.byteLength,
    sha256: sha256(contents),
  }) satisfies SeethingSwarmGeneratedModuleReceipt
}

function createAggregateHashInput(
  evidenceSnapshotId: string,
  assets: readonly SeethingSwarmAssetReceiptEntry[],
  generatedModules: SeethingSwarmAssetReceipt["generatedModules"],
) {
  return JSON.stringify({ evidenceSnapshotId, assets, generatedModules })
}

export function serializeSeethingSwarmAssetReceipt(
  receipt: SeethingSwarmAssetReceipt,
) {
  return `${JSON.stringify(receipt, null, 2)}\n`
}

export async function createSeethingSwarmAssetReceipt(
  stagingRoot: string,
  staging: SeethingSwarmStagingResult,
  webModuleSource: string,
  nativeModuleSource: string,
) {
  assertSeethingSwarmStaticAssetModuleInputs(staging, "receipt")
  const resolvedStagingRoot = resolve(stagingRoot)
  const assets: SeethingSwarmAssetReceiptEntry[] = []
  for (const asset of staging.assets) {
    assets.push(await verifyStagedAsset(resolvedStagingRoot, asset))
  }

  const generatedModules = Object.freeze({
    web: createGeneratedModuleReceipt(webModuleSource, "web"),
    native: createGeneratedModuleReceipt(nativeModuleSource, "native"),
  })
  const receiptWithoutAggregate = {
    schemaVersion: SEETHING_SWARM_ASSET_RECEIPT_SCHEMA_VERSION,
    evidenceSnapshotId: staging.evidenceSnapshotId,
    assetCount: assets.length,
    totalBytes: staging.totalBytes,
    assets: Object.freeze(assets),
    generatedModules,
  } as const

  return Object.freeze({
    ...receiptWithoutAggregate,
    aggregateSha256: sha256(
      createAggregateHashInput(
        receiptWithoutAggregate.evidenceSnapshotId,
        receiptWithoutAggregate.assets,
        receiptWithoutAggregate.generatedModules,
      ),
    ),
  }) satisfies SeethingSwarmAssetReceipt
}

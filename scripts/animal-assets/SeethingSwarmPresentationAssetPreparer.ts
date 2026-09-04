import { createHash, randomUUID } from "node:crypto"
import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path"
import { createSeethingSwarmAnimalManifest } from "#game/data/src/SeethingSwarmAnimalManifest"
import {
  createSeethingSwarmAnimalRegistry,
  type SeethingSwarmAnimalRegistry,
} from "#game/data/src/SeethingSwarmAnimalRegistry"
import {
  createSeethingSwarmLicensedRuntimeClipCatalog,
  createSeethingSwarmTypographyOnlyRuntimeClipCatalog,
  type SeethingSwarmRuntimeAssetSource,
  type SeethingSwarmRuntimeClipCatalog,
} from "#game/data/src/SeethingSwarmRuntimeClipCatalog"
import { ZOO_ANIMALS, type ZooAnimalId } from "#game/data/src/ZooAnimals"
import {
  SEETHING_SWARM_ASSET_RECEIPT_SCHEMA_VERSION,
  type SeethingSwarmAssetReceipt,
  type SeethingSwarmAssetReceiptEntry,
  type SeethingSwarmGeneratedModuleReceipt,
} from "./SeethingSwarmAssetReceipt"
import { publishSeethingSwarmPreparedAssetTree } from "./SeethingSwarmAssetStager"
import {
  analyzeSeethingSwarmVisibleContentFile,
  type SeethingSwarmVisibleContentSelection,
} from "./SeethingSwarmVisibleContentAnalyzer"

export const SEETHING_SWARM_RUNTIME_CLIP_CATALOG_MODULE_FILE_NAME =
  "SeethingSwarmRuntimeClipCatalog.ts"

export type SeethingSwarmPresentationPreparationPaths = Readonly<{
  registryPath: string
  stagingRoot: string
  receiptPath: string
  webOutputRoot: string
  nativeOutputRoot: string
}>

export type SeethingSwarmRuntimeClipCatalogModuleGenerators = Readonly<{
  web: (catalog: SeethingSwarmRuntimeClipCatalog<string>) => string
  native: (catalog: SeethingSwarmRuntimeClipCatalog<string>) => string
}>

function compareText(first: string, second: string) {
  if (first < second) return -1
  if (first > second) return 1
  return 0
}

function assertSafeRelativePngPath(value: string, label: string) {
  const segments = value.split("/")
  if (
    value === "" ||
    value.includes("\\") ||
    value.startsWith("/") ||
    value.endsWith("/") ||
    !value.endsWith(".png") ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    throw new Error(`Invalid SeethingSwarm ${label} asset path: ${value}`)
  }
}

function assertObject(value: unknown, label: string): asserts value is object {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${label}: expected object`)
  }
}

function getProperty(value: object, property: string) {
  return Reflect.get(value, property) as unknown
}

function getStringProperty(value: object, property: string, label: string) {
  const candidate = getProperty(value, property)
  if (typeof candidate !== "string" || candidate.trim() === "") {
    throw new Error(`Invalid ${label}: ${property}`)
  }
  return candidate
}

function getPositiveSafeIntegerProperty(
  value: object,
  property: string,
  label: string,
) {
  const candidate = getProperty(value, property)
  if (!Number.isSafeInteger(candidate) || (candidate as number) <= 0) {
    throw new Error(`Invalid ${label}: ${property}`)
  }
  return candidate as number
}

function getObjectProperty(value: object, property: string, label: string) {
  const candidate = getProperty(value, property)
  assertObject(candidate, `${label} ${property}`)
  return candidate
}

function getArrayProperty(value: object, property: string, label: string) {
  const candidate = getProperty(value, property)
  if (!Array.isArray(candidate)) {
    throw new Error(`Invalid ${label}: ${property}`)
  }
  return candidate as readonly unknown[]
}

function parseCharacterAnimations(value: object) {
  const animations = getObjectProperty(value, "animations", "animal registry")
  return Object.freeze(
    Object.keys(animations)
      .toSorted()
      .map((animationId) => {
        const animation = getProperty(animations, animationId)
        assertObject(animation, `character animation ${animationId}`)
        return Object.freeze({
          animationId,
          relativePath: getStringProperty(
            animation,
            "relativePath",
            `character animation ${animationId}`,
          ),
          frameCount: getPositiveSafeIntegerProperty(
            animation,
            "frameCount",
            `character animation ${animationId}`,
          ),
        })
      }),
  )
}

function parseAuxiliaryEffects(value: object) {
  const candidate = getProperty(value, "auxiliaryEffects")
  if (candidate === undefined) return undefined
  assertObject(candidate, "animal registry auxiliary effects")

  return Object.freeze(
    Object.keys(candidate)
      .toSorted()
      .map((effectId) => {
        const effect = getProperty(candidate, effectId)
        assertObject(effect, `auxiliary effect ${effectId}`)
        return Object.freeze({
          effectId,
          relativePath: getStringProperty(
            effect,
            "relativePath",
            `auxiliary effect ${effectId}`,
          ),
          frameWidth: getPositiveSafeIntegerProperty(
            effect,
            "frameWidth",
            `auxiliary effect ${effectId}`,
          ),
          frameHeight: getPositiveSafeIntegerProperty(
            effect,
            "frameHeight",
            `auxiliary effect ${effectId}`,
          ),
          frameCount: getPositiveSafeIntegerProperty(
            effect,
            "frameCount",
            `auxiliary effect ${effectId}`,
          ),
        })
      }),
  )
}

function parseAnimalId(value: object) {
  const candidate = getStringProperty(value, "animalId", "animal registry")
  if (!ZOO_ANIMALS.some(({ id }) => id === candidate)) {
    throw new Error(`Invalid animal registry animalId: ${candidate}`)
  }
  return candidate as ZooAnimalId
}

export function parseSeethingSwarmAnimalRegistryJson(contents: string) {
  const parsed = JSON.parse(contents) as unknown
  assertObject(parsed, "SeethingSwarm animal registry")
  const animals = getArrayProperty(parsed, "animals", "animal registry")
  const manifests = animals.map((candidate) => {
    assertObject(candidate, "animal registry entry")
    const auxiliaryEffects = parseAuxiliaryEffects(candidate)
    return createSeethingSwarmAnimalManifest({
      animalId: parseAnimalId(candidate),
      familyId: getStringProperty(candidate, "familyId", "animal registry"),
      sourceRelativePath: getStringProperty(
        candidate,
        "sourceRelativePath",
        "animal registry",
      ),
      sourceColorLabel: getStringProperty(
        candidate,
        "sourceColorLabel",
        "animal registry",
      ),
      frameWidth: getPositiveSafeIntegerProperty(
        candidate,
        "frameWidth",
        "animal registry",
      ),
      frameHeight: getPositiveSafeIntegerProperty(
        candidate,
        "frameHeight",
        "animal registry",
      ),
      animations: parseCharacterAnimations(candidate),
      ...(auxiliaryEffects ? { auxiliaryEffects } : {}),
      evidenceSnapshotId: getStringProperty(
        candidate,
        "evidenceSnapshotId",
        "animal registry",
      ),
    })
  })
  const registry = createSeethingSwarmAnimalRegistry(manifests)
  const declaredSnapshotId = getStringProperty(
    parsed,
    "evidenceSnapshotId",
    "animal registry",
  )
  if (declaredSnapshotId !== registry.evidenceSnapshotId) {
    throw new Error(
      `Mismatched SeethingSwarm registry snapshot: ${declaredSnapshotId}`,
    )
  }

  return registry
}

function parseReceiptEntry(candidate: unknown) {
  assertObject(candidate, "SeethingSwarm receipt entry")
  const relativePath = getStringProperty(
    candidate,
    "relativePath",
    "receipt entry",
  )
  assertSafeRelativePngPath(relativePath, "receipt")
  const sha256 = getStringProperty(candidate, "sha256", "receipt entry")
  if (!/^[0-9a-f]{64}$/u.test(sha256)) {
    throw new Error(`Invalid SeethingSwarm receipt SHA-256: ${relativePath}`)
  }

  return Object.freeze({
    relativePath,
    byteLength: getPositiveSafeIntegerProperty(
      candidate,
      "byteLength",
      "receipt entry",
    ),
    sha256,
  }) satisfies SeethingSwarmAssetReceiptEntry
}

function parseGeneratedModuleReceipt(candidate: unknown, label: string) {
  assertObject(candidate, `SeethingSwarm ${label} module receipt`)
  const sha256 = getStringProperty(candidate, "sha256", `${label} receipt`)
  if (!/^[0-9a-f]{64}$/u.test(sha256)) {
    throw new Error(`Invalid SeethingSwarm ${label} module SHA-256`)
  }
  return Object.freeze({
    byteLength: getPositiveSafeIntegerProperty(
      candidate,
      "byteLength",
      `${label} receipt`,
    ),
    sha256,
  }) satisfies SeethingSwarmGeneratedModuleReceipt
}

function getSha256(contents: Uint8Array | string) {
  return createHash("sha256").update(contents).digest("hex")
}

export function parseSeethingSwarmAssetReceiptJson(contents: string) {
  const parsed = JSON.parse(contents) as unknown
  assertObject(parsed, "SeethingSwarm asset receipt")
  if (
    getProperty(parsed, "schemaVersion") !==
    SEETHING_SWARM_ASSET_RECEIPT_SCHEMA_VERSION
  ) {
    throw new Error("Invalid SeethingSwarm receipt schema version")
  }

  const assets = Object.freeze(
    getArrayProperty(parsed, "assets", "asset receipt").map(parseReceiptEntry),
  )
  const comparablePaths = new Set<string>()
  for (const [index, asset] of assets.entries()) {
    const comparablePath = asset.relativePath.toLowerCase()
    if (comparablePaths.has(comparablePath)) {
      throw new Error(
        `Duplicate SeethingSwarm receipt asset: ${asset.relativePath}`,
      )
    }
    if (index > 0 && assets[index - 1]!.relativePath > asset.relativePath) {
      throw new Error(
        `Unsorted SeethingSwarm receipt asset: ${asset.relativePath}`,
      )
    }
    comparablePaths.add(comparablePath)
  }

  const evidenceSnapshotId = getStringProperty(
    parsed,
    "evidenceSnapshotId",
    "asset receipt",
  )
  const assetCount = getPositiveSafeIntegerProperty(
    parsed,
    "assetCount",
    "asset receipt",
  )
  if (assetCount !== assets.length) {
    throw new Error(
      `Invalid SeethingSwarm receipt asset count: expected ${assets.length}, received ${assetCount}`,
    )
  }
  const totalBytes = getPositiveSafeIntegerProperty(
    parsed,
    "totalBytes",
    "asset receipt",
  )
  const expectedTotalBytes = assets.reduce(
    (total, asset) => total + asset.byteLength,
    0,
  )
  if (totalBytes !== expectedTotalBytes) {
    throw new Error(
      `Invalid SeethingSwarm receipt byte total: expected ${expectedTotalBytes}, received ${totalBytes}`,
    )
  }

  const generatedModuleCandidate = getObjectProperty(
    parsed,
    "generatedModules",
    "asset receipt",
  )
  const generatedModules = Object.freeze({
    web: parseGeneratedModuleReceipt(
      getProperty(generatedModuleCandidate, "web"),
      "web",
    ),
    native: parseGeneratedModuleReceipt(
      getProperty(generatedModuleCandidate, "native"),
      "native",
    ),
  })
  const aggregateSha256 = getStringProperty(
    parsed,
    "aggregateSha256",
    "asset receipt",
  )
  const expectedAggregateSha256 = getSha256(
    JSON.stringify({ evidenceSnapshotId, assets, generatedModules }),
  )
  if (aggregateSha256 !== expectedAggregateSha256) {
    throw new Error("Invalid SeethingSwarm receipt aggregate SHA-256")
  }

  return Object.freeze({
    schemaVersion: SEETHING_SWARM_ASSET_RECEIPT_SCHEMA_VERSION,
    evidenceSnapshotId,
    assetCount,
    totalBytes,
    assets,
    generatedModules,
    aggregateSha256,
  }) satisfies SeethingSwarmAssetReceipt
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

function isPathOutsideRoot(root: string, candidate: string) {
  const relativePath = relative(root, candidate)
  return (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  )
}

function assertSeparateTrees(firstRoot: string, secondRoot: string) {
  if (
    firstRoot === secondRoot ||
    !isPathOutsideRoot(firstRoot, secondRoot) ||
    !isPathOutsideRoot(secondRoot, firstRoot)
  ) {
    throw new Error("SeethingSwarm presentation trees must be separate")
  }
}

function resolveConfinedAssetPath(root: string, relativePath: string) {
  const absolutePath = resolve(root, ...relativePath.split("/"))
  if (isPathOutsideRoot(root, absolutePath)) {
    throw new Error(`Unsafe SeethingSwarm presentation path: ${relativePath}`)
  }
  return absolutePath
}

async function assertRealPath(
  path: string,
  expectedType: "file" | "directory",
) {
  const stats = await lstat(path)
  const matchesType =
    expectedType === "file" ? stats.isFile() : stats.isDirectory()
  if (stats.isSymbolicLink() || !matchesType) {
    throw new Error(`Invalid SeethingSwarm presentation ${expectedType}`)
  }
}

function listSeethingSwarmRuntimeClipSelections(
  registry: SeethingSwarmAnimalRegistry,
) {
  const selections: SeethingSwarmVisibleContentSelection[] = []
  for (const animal of registry.animals) {
    for (const [, animation] of Object.entries(animal.animations).toSorted(
      ([firstAnimationId], [secondAnimationId]) =>
        compareText(firstAnimationId, secondAnimationId),
    )) {
      selections.push(
        Object.freeze({
          animalId: animal.animalId,
          relativePath: animation.relativePath,
          frameWidth: animal.frameWidth,
          frameHeight: animal.frameHeight,
          frameCount: animation.frameCount,
        }),
      )
    }
    for (const [, effect] of Object.entries(
      animal.auxiliaryEffects ?? {},
    ).toSorted(([firstEffectId], [secondEffectId]) =>
      compareText(firstEffectId, secondEffectId),
    )) {
      selections.push(
        Object.freeze({
          animalId: animal.animalId,
          relativePath: effect.relativePath,
          frameWidth: effect.frameWidth,
          frameHeight: effect.frameHeight,
          frameCount: effect.frameCount,
        }),
      )
    }
  }
  return Object.freeze(
    selections.toSorted((first, second) =>
      compareText(first.relativePath, second.relativePath),
    ),
  )
}

async function createLicensedRuntimeClipCatalog(
  registryPath: string,
  stagingRoot: string,
  receiptPath: string,
  webPreparedRoot: string,
  nativePreparedRoot: string,
) {
  await Promise.all([
    assertRealPath(registryPath, "file"),
    assertRealPath(stagingRoot, "directory"),
    assertRealPath(receiptPath, "file"),
  ])
  const [registryContents, receiptContents] = await Promise.all([
    readFile(registryPath, "utf8"),
    readFile(receiptPath, "utf8"),
  ])
  const registry = parseSeethingSwarmAnimalRegistryJson(registryContents)
  const receipt = parseSeethingSwarmAssetReceiptJson(receiptContents)
  if (receipt.evidenceSnapshotId !== registry.evidenceSnapshotId) {
    throw new Error("Mismatched SeethingSwarm registry and receipt snapshots")
  }

  const receiptAssets = new Map(
    receipt.assets.map((asset) => [asset.relativePath, asset]),
  )
  const selections = listSeethingSwarmRuntimeClipSelections(registry)
  if (selections.length !== receipt.assets.length) {
    throw new Error(
      `Mismatched SeethingSwarm runtime asset count: expected ${receipt.assets.length}, received ${selections.length}`,
    )
  }

  const sources: SeethingSwarmRuntimeAssetSource<string>[] = []
  for (const selection of selections) {
    const expectedAsset = receiptAssets.get(selection.relativePath)
    if (!expectedAsset) {
      throw new Error(
        `Missing SeethingSwarm runtime receipt asset: ${selection.relativePath}`,
      )
    }
    const sourcePath = resolveConfinedAssetPath(
      stagingRoot,
      selection.relativePath,
    )
    await assertRealPath(sourcePath, "file")
    const contents = await readFile(sourcePath)
    if (
      contents.byteLength !== expectedAsset.byteLength ||
      getSha256(contents) !== expectedAsset.sha256
    ) {
      throw new Error(
        `Altered SeethingSwarm runtime asset: ${selection.relativePath}`,
      )
    }
    const analysis = await analyzeSeethingSwarmVisibleContentFile(
      sourcePath,
      selection,
    )

    for (const outputRoot of [webPreparedRoot, nativePreparedRoot]) {
      const outputPath = resolveConfinedAssetPath(
        resolve(outputRoot, "assets"),
        selection.relativePath,
      )
      await mkdir(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, contents, { flag: "wx" })
    }

    sources.push(
      Object.freeze({
        relativePath: selection.relativePath,
        visibleBounds: analysis.unionVisibleBounds,
        asset: selection.relativePath,
      }),
    )
  }

  return createSeethingSwarmLicensedRuntimeClipCatalog(registry, sources)
}

function createPreparedRoot(outputRoot: string) {
  return resolve(
    dirname(outputRoot),
    `.${basename(outputRoot)}.${randomUUID()}.prepared`,
  )
}

async function writeGeneratedModules(
  webPreparedRoot: string,
  nativePreparedRoot: string,
  catalog: SeethingSwarmRuntimeClipCatalog<string>,
  generators: SeethingSwarmRuntimeClipCatalogModuleGenerators,
) {
  const webModuleSource = generators.web(catalog)
  const nativeModuleSource = generators.native(catalog)
  if (webModuleSource.trim() === "" || nativeModuleSource.trim() === "") {
    throw new Error("Missing generated SeethingSwarm runtime clip module")
  }
  await Promise.all([
    writeFile(
      resolve(
        webPreparedRoot,
        SEETHING_SWARM_RUNTIME_CLIP_CATALOG_MODULE_FILE_NAME,
      ),
      webModuleSource,
      { encoding: "utf8", flag: "wx" },
    ),
    writeFile(
      resolve(
        nativePreparedRoot,
        SEETHING_SWARM_RUNTIME_CLIP_CATALOG_MODULE_FILE_NAME,
      ),
      nativeModuleSource,
      { encoding: "utf8", flag: "wx" },
    ),
  ])
}

export async function prepareSeethingSwarmPresentationAssets(
  paths: SeethingSwarmPresentationPreparationPaths,
  generators: SeethingSwarmRuntimeClipCatalogModuleGenerators,
) {
  const resolvedPaths = Object.freeze({
    registryPath: resolve(paths.registryPath),
    stagingRoot: resolve(paths.stagingRoot),
    receiptPath: resolve(paths.receiptPath),
    webOutputRoot: resolve(paths.webOutputRoot),
    nativeOutputRoot: resolve(paths.nativeOutputRoot),
  })
  assertSeparateTrees(
    resolvedPaths.webOutputRoot,
    resolvedPaths.nativeOutputRoot,
  )
  assertSeparateTrees(resolvedPaths.stagingRoot, resolvedPaths.webOutputRoot)
  assertSeparateTrees(resolvedPaths.stagingRoot, resolvedPaths.nativeOutputRoot)

  const custodyStates = await Promise.all([
    pathExists(resolvedPaths.registryPath),
    pathExists(resolvedPaths.stagingRoot),
    pathExists(resolvedPaths.receiptPath),
  ])
  const hasAnyCustody = custodyStates.some(Boolean)
  const hasCompleteCustody = custodyStates.every(Boolean)
  if (hasAnyCustody && !hasCompleteCustody) {
    throw new Error("Partial SeethingSwarm presentation custody")
  }

  const webPreparedRoot = createPreparedRoot(resolvedPaths.webOutputRoot)
  const nativePreparedRoot = createPreparedRoot(resolvedPaths.nativeOutputRoot)
  await Promise.all([
    mkdir(dirname(webPreparedRoot), { recursive: true }),
    mkdir(dirname(nativePreparedRoot), { recursive: true }),
  ])

  try {
    await Promise.all([
      mkdir(webPreparedRoot, { recursive: false }),
      mkdir(nativePreparedRoot, { recursive: false }),
    ])
    const catalog = hasCompleteCustody
      ? await createLicensedRuntimeClipCatalog(
          resolvedPaths.registryPath,
          resolvedPaths.stagingRoot,
          resolvedPaths.receiptPath,
          webPreparedRoot,
          nativePreparedRoot,
        )
      : createSeethingSwarmTypographyOnlyRuntimeClipCatalog()
    await writeGeneratedModules(
      webPreparedRoot,
      nativePreparedRoot,
      catalog,
      generators,
    )
    await publishSeethingSwarmPreparedAssetTree(
      webPreparedRoot,
      resolvedPaths.webOutputRoot,
    )
    await publishSeethingSwarmPreparedAssetTree(
      nativePreparedRoot,
      resolvedPaths.nativeOutputRoot,
    )

    return Object.freeze({
      mode: catalog.mode,
      assetCount:
        catalog.mode === "licensed"
          ? catalog.characterClipCount + catalog.auxiliaryEffectClipCount
          : 0,
    })
  } catch (error: unknown) {
    await Promise.all([
      rm(webPreparedRoot, { recursive: true, force: true }),
      rm(nativePreparedRoot, { recursive: true, force: true }),
    ])
    throw error
  }
}

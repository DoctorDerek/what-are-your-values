import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, relative } from "node:path"
import { SEETHING_SWARM_SOURCE_SNAPSHOT } from "#game/data/src/SeethingSwarmSourceEvidence"
import { ZOO_ANIMALS } from "#game/data/src/ZooAnimals"
import sharp from "sharp"
import { SEETHING_SWARM_ASSET_RECEIPT_SCHEMA_VERSION } from "./SeethingSwarmAssetReceipt"
import { generateSeethingSwarmNativeRuntimeClipCatalogModule } from "./SeethingSwarmNativeRuntimeClipCatalogModuleGenerator"
import type { SeethingSwarmPresentationPreparationPaths } from "./SeethingSwarmPresentationAssetPreparer"
import { generateSeethingSwarmWebRuntimeClipCatalogModule } from "./SeethingSwarmWebRuntimeClipCatalogModuleGenerator"

export const seethingSwarmPresentationModuleGenerators = Object.freeze({
  web: generateSeethingSwarmWebRuntimeClipCatalogModule,
  native: generateSeethingSwarmNativeRuntimeClipCatalogModule,
})

const temporaryDirectories: string[] = []

export async function cleanUpSeethingSwarmPresentationTestWorkspaces() {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
}

function sha256(contents: Uint8Array | string) {
  return createHash("sha256").update(contents).digest("hex")
}

export async function createSeethingSwarmPresentationTestWorkspace() {
  const repositoryRoot = await mkdtemp(
    join(tmpdir(), "wayvm-presentation-preparer-"),
  )
  temporaryDirectories.push(repositoryRoot)
  const stagingRoot = join(repositoryRoot, "vendor", "seethingswarm", "assets")
  return Object.freeze({
    repositoryRoot,
    registryPath: join(
      repositoryRoot,
      "vendor",
      "seethingswarm",
      "registry.json",
    ),
    stagingRoot,
    receiptPath: join(stagingRoot, "staging-receipt.json"),
    webOutputRoot: join(
      repositoryRoot,
      "apps",
      "web",
      "generated",
      "seethingswarm",
    ),
    nativeOutputRoot: join(
      repositoryRoot,
      "apps",
      "mobile",
      "generated",
      "seethingswarm",
    ),
  }) satisfies SeethingSwarmPresentationPreparationPaths & {
    repositoryRoot: string
  }
}

export async function writeSeethingSwarmPresentationTestFile(
  root: string,
  relativePath: string,
  contents: Uint8Array | string,
) {
  const absolutePath = join(root, ...relativePath.split("/"))
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, contents)
  return absolutePath
}

export async function listSeethingSwarmPresentationTestFiles(
  root: string,
  currentRoot = root,
) {
  const entries = await readdir(currentRoot, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const absolutePath = join(currentRoot, entry.name)
    if (entry.isDirectory()) {
      files.push(
        ...(await listSeethingSwarmPresentationTestFiles(root, absolutePath)),
      )
    } else {
      files.push(relative(root, absolutePath).replaceAll("\\", "/"))
    }
  }
  return files.toSorted()
}

export function createSeethingSwarmPresentationRegistryFixture() {
  const selectedPaths: string[] = []
  const allAssetPaths: string[] = []
  const animals = ZOO_ANIMALS.map(({ id }, animalIndex) => {
    const animationCount = animalIndex === 0 ? 26 : 17
    const calmAnimationId = id === "bat" ? "idle_upright" : "idle"
    const directory = `pack_${animalIndex.toString().padStart(2, "0")}`
    const selectedPath = `${directory}/calm_${calmAnimationId}_strip4.png`
    selectedPaths.push(selectedPath)
    allAssetPaths.push(selectedPath)

    const animations = Object.fromEntries([
      [calmAnimationId, { relativePath: selectedPath, frameCount: 4 }],
      ...Array.from({ length: animationCount - 1 }, (_, animationIndex) => {
        const animationId = `motion_${animationIndex
          .toString()
          .padStart(2, "0")}`
        const relativePath = `${directory}/${animationId}_strip1.png`
        allAssetPaths.push(relativePath)
        return [animationId, { relativePath, frameCount: 1 }] as const
      }),
    ])
    const auxiliaryEffectPath = `${directory}/effect_strip2.png`

    return {
      animalId: id,
      familyId: `family_${animalIndex.toString().padStart(2, "0")}`,
      sourceRelativePath: directory,
      sourceColorLabel: "Synthetic test palette",
      frameWidth: 4,
      frameHeight: 4,
      animations,
      ...(animalIndex === 0
        ? {
            auxiliaryEffects: {
              effect: {
                relativePath: auxiliaryEffectPath,
                frameWidth: 4,
                frameHeight: 4,
                frameCount: 2,
              },
            },
          }
        : {}),
      evidenceSnapshotId: SEETHING_SWARM_SOURCE_SNAPSHOT.sourceSnapshotId,
    }
  })
  allAssetPaths.push("pack_00/effect_strip2.png")

  return Object.freeze({
    registry: Object.freeze({
      evidenceSnapshotId: SEETHING_SWARM_SOURCE_SNAPSHOT.sourceSnapshotId,
      animals: Object.freeze(animals),
    }),
    selectedPaths: Object.freeze(selectedPaths),
    allAssetPaths: Object.freeze(allAssetPaths.toSorted()),
  })
}

function createReceipt(assetContents: ReadonlyMap<string, Uint8Array>) {
  const assets = Object.freeze(
    [...assetContents.entries()].map(([relativePath, contents]) => {
      return Object.freeze({
        relativePath,
        byteLength: contents.byteLength,
        sha256: sha256(contents),
      })
    }),
  )
  const generatedModules = Object.freeze({
    web: Object.freeze({ byteLength: 1, sha256: sha256("w") }),
    native: Object.freeze({ byteLength: 1, sha256: sha256("n") }),
  })
  const evidenceSnapshotId = SEETHING_SWARM_SOURCE_SNAPSHOT.sourceSnapshotId

  return Object.freeze({
    schemaVersion: SEETHING_SWARM_ASSET_RECEIPT_SCHEMA_VERSION,
    evidenceSnapshotId,
    assetCount: assets.length,
    totalBytes: assets.reduce(
      (totalBytes, asset) => totalBytes + asset.byteLength,
      0,
    ),
    assets,
    generatedModules,
    aggregateSha256: sha256(
      JSON.stringify({ evidenceSnapshotId, assets, generatedModules }),
    ),
  })
}

export function rebuildSeethingSwarmPresentationReceipt(
  receipt: ReturnType<typeof createReceipt>,
  overrides: Readonly<{
    evidenceSnapshotId?: string
    assets?: ReturnType<typeof createReceipt>["assets"]
  }> = {},
) {
  const evidenceSnapshotId =
    overrides.evidenceSnapshotId ?? receipt.evidenceSnapshotId
  const assets = overrides.assets ?? receipt.assets
  const generatedModules = receipt.generatedModules
  return Object.freeze({
    ...receipt,
    evidenceSnapshotId,
    assetCount: assets.length,
    totalBytes: assets.reduce(
      (totalBytes, asset) => totalBytes + asset.byteLength,
      0,
    ),
    assets,
    aggregateSha256: sha256(
      JSON.stringify({ evidenceSnapshotId, assets, generatedModules }),
    ),
  })
}

export async function createCompleteSeethingSwarmPresentationCustody(
  paths: SeethingSwarmPresentationPreparationPaths,
) {
  const fixture = createSeethingSwarmPresentationRegistryFixture()
  const frameCounts = [1, 2, 4] as const
  const stripPngEntries = await Promise.all(
    frameCounts.map(async (frameCount) => {
      const width = 4 * frameCount
      const rawStrip = Buffer.alloc(width * 4 * 4, 255)
      const png = await sharp(rawStrip, {
        raw: { width, height: 4, channels: 4 },
      })
        .png()
        .toBuffer()
      return [frameCount, png] as const
    }),
  )
  const stripPngs = new Map(stripPngEntries)
  const assetContents = new Map(
    fixture.allAssetPaths.map((relativePath) => {
      const frameCount = Number(relativePath.match(/strip(\d+)\.png$/u)?.[1])
      const contents = stripPngs.get(frameCount as 1 | 2 | 4)
      if (!contents) {
        throw new Error(`Missing test PNG geometry for ${relativePath}`)
      }
      return [relativePath, contents] as const
    }),
  )
  const receipt = createReceipt(assetContents)
  const selectedPng = stripPngs.get(4)!

  await Promise.all([
    writeSeethingSwarmPresentationTestFile(
      dirname(paths.registryPath),
      "registry.json",
      `${JSON.stringify(fixture.registry, null, 2)}\n`,
    ),
    writeSeethingSwarmPresentationTestFile(
      paths.stagingRoot,
      "SeethingSwarmNativeStaticAssets.ts",
      "n",
    ),
    writeSeethingSwarmPresentationTestFile(
      paths.stagingRoot,
      "SeethingSwarmWebStaticAssets.ts",
      "w",
    ),
    ...fixture.allAssetPaths.map((relativePath) =>
      writeSeethingSwarmPresentationTestFile(
        paths.stagingRoot,
        relativePath,
        assetContents.get(relativePath)!,
      ),
    ),
  ])
  await writeFile(paths.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)

  return Object.freeze({ ...fixture, assetContents, selectedPng, receipt })
}

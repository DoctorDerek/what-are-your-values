import { createHash } from "node:crypto"
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, relative } from "node:path"
import { SEETHING_SWARM_SOURCE_SNAPSHOT } from "#game/data/src/SeethingSwarmSourceEvidence"
import { ZOO_ANIMALS } from "#game/data/src/ZooAnimals"
import sharp from "sharp"
import { afterEach, describe, expect, it } from "vitest"
import { SEETHING_SWARM_ASSET_RECEIPT_SCHEMA_VERSION } from "./SeethingSwarmAssetReceipt"
import { generateSeethingSwarmNativePresentationModule } from "./SeethingSwarmNativePresentationModuleGenerator"
import {
  parseSeethingSwarmAnimalRegistryJson,
  parseSeethingSwarmAssetReceiptJson,
  prepareSeethingSwarmPresentationAssets,
  SEETHING_SWARM_PRESENTATION_MODULE_FILE_NAME,
  type SeethingSwarmPresentationPreparationPaths,
} from "./SeethingSwarmPresentationAssetPreparer"
import { generateSeethingSwarmWebPresentationModule } from "./SeethingSwarmWebPresentationModuleGenerator"

const moduleGenerators = Object.freeze({
  web: generateSeethingSwarmWebPresentationModule,
  native: generateSeethingSwarmNativePresentationModule,
})
const FULL_CUSTODY_INTEGRATION_TEST_TIMEOUT_MS = 15_000
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

function sha256(contents: Uint8Array | string) {
  return createHash("sha256").update(contents).digest("hex")
}

async function createWorkspace() {
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

async function writeRelativeFile(
  root: string,
  relativePath: string,
  contents: Uint8Array | string,
) {
  const absolutePath = join(root, ...relativePath.split("/"))
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, contents)
  return absolutePath
}

async function listRelativeFiles(root: string, currentRoot = root) {
  const entries = await readdir(currentRoot, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const absolutePath = join(currentRoot, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(root, absolutePath)))
    } else {
      files.push(relative(root, absolutePath).replaceAll("\\", "/"))
    }
  }
  return files.toSorted()
}

function createRegistryDocument() {
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

function createReceipt(
  allAssetPaths: readonly string[],
  selectedPaths: readonly string[],
  selectedPng: Uint8Array,
) {
  const selectedPathSet = new Set(selectedPaths)
  const assets = Object.freeze(
    allAssetPaths.map((relativePath) => {
      const contents = selectedPathSet.has(relativePath)
        ? selectedPng
        : Buffer.from(relativePath)
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

function rebuildReceipt(
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

async function createCompleteCustody(
  paths: SeethingSwarmPresentationPreparationPaths,
) {
  const fixture = createRegistryDocument()
  const rawStrip = Buffer.alloc(4 * 4 * 4 * 4, 255)
  const selectedPng = await sharp(rawStrip, {
    raw: { width: 16, height: 4, channels: 4 },
  })
    .png()
    .toBuffer()
  const receipt = createReceipt(
    fixture.allAssetPaths,
    fixture.selectedPaths,
    selectedPng,
  )

  await Promise.all([
    writeRelativeFile(
      dirname(paths.registryPath),
      "registry.json",
      `${JSON.stringify(fixture.registry, null, 2)}\n`,
    ),
    ...fixture.selectedPaths.map((relativePath) =>
      writeRelativeFile(paths.stagingRoot, relativePath, selectedPng),
    ),
  ])
  await writeFile(paths.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)

  return Object.freeze({ ...fixture, selectedPng, receipt })
}

async function readGeneratedModule(outputRoot: string) {
  return readFile(
    join(outputRoot, SEETHING_SWARM_PRESENTATION_MODULE_FILE_NAME),
    "utf8",
  )
}

async function expectNoPreparedSiblings(outputRoot: string) {
  const outputParent = dirname(outputRoot)
  expect(
    (await readdir(outputParent)).filter((entry) =>
      entry.startsWith(`.${SEETHING_SWARM_PRESENTATION_MODULE_FILE_NAME}.`),
    ),
  ).toEqual([])
  expect(
    (await readdir(outputParent)).filter((entry) =>
      entry.startsWith(".seethingswarm."),
    ),
  ).toEqual([])
}

describe("SeethingSwarm presentation asset preparer", () => {
  it("replaces stale licensed output with deterministic clean-clone typography bindings", async () => {
    const paths = await createWorkspace()
    await Promise.all([
      writeRelativeFile(
        paths.webOutputRoot,
        "assets/private/stale.png",
        "stale-web",
      ),
      writeRelativeFile(
        paths.nativeOutputRoot,
        "assets/private/stale.png",
        "stale-native",
      ),
    ])

    const firstResult = await prepareSeethingSwarmPresentationAssets(
      paths,
      moduleGenerators,
    )
    const firstWebModule = await readGeneratedModule(paths.webOutputRoot)
    const firstNativeModule = await readGeneratedModule(paths.nativeOutputRoot)
    const secondResult = await prepareSeethingSwarmPresentationAssets(
      paths,
      moduleGenerators,
    )

    expect(firstResult).toEqual({ mode: "typography-only", assetCount: 0 })
    expect(secondResult).toEqual(firstResult)
    expect(Object.isFrozen(firstResult)).toBe(true)
    expect(await listRelativeFiles(paths.webOutputRoot)).toEqual([
      SEETHING_SWARM_PRESENTATION_MODULE_FILE_NAME,
    ])
    expect(await listRelativeFiles(paths.nativeOutputRoot)).toEqual([
      SEETHING_SWARM_PRESENTATION_MODULE_FILE_NAME,
    ])
    expect(await readGeneratedModule(paths.webOutputRoot)).toBe(firstWebModule)
    expect(await readGeneratedModule(paths.nativeOutputRoot)).toBe(
      firstNativeModule,
    )
    expect(firstWebModule).toContain(
      "createSeethingSwarmTypographyOnlyAnimalPresentationAdapter",
    )
    expect(firstNativeModule).toContain(
      "createSeethingSwarmTypographyOnlyAnimalPresentationAdapter",
    )
    expect(firstWebModule).not.toContain("./assets/")
    expect(firstNativeModule).not.toContain("./assets/")
  })

  it(
    "copies exactly 45 receipt-verified calm strips into deterministic platform trees",
    async () => {
      const paths = await createWorkspace()
      const fixture = await createCompleteCustody(paths)

      const firstResult = await prepareSeethingSwarmPresentationAssets(
        paths,
        moduleGenerators,
      )
      const firstWebFiles = await listRelativeFiles(paths.webOutputRoot)
      const firstNativeFiles = await listRelativeFiles(paths.nativeOutputRoot)
      const firstWebModule = await readGeneratedModule(paths.webOutputRoot)
      const firstNativeModule = await readGeneratedModule(
        paths.nativeOutputRoot,
      )
      const secondResult = await prepareSeethingSwarmPresentationAssets(
        paths,
        moduleGenerators,
      )

      expect(firstResult).toEqual({ mode: "licensed", assetCount: 45 })
      expect(secondResult).toEqual(firstResult)
      expect(Object.isFrozen(firstResult)).toBe(true)
      expect(firstWebFiles).toHaveLength(46)
      expect(firstNativeFiles).toHaveLength(46)
      expect(
        firstWebFiles.filter((relativePath) => relativePath.endsWith(".png")),
      ).toEqual(
        fixture.selectedPaths.map((path) => `assets/${path}`).toSorted(),
      )
      expect(
        firstNativeFiles.filter((relativePath) =>
          relativePath.endsWith(".png"),
        ),
      ).toEqual(
        fixture.selectedPaths.map((path) => `assets/${path}`).toSorted(),
      )
      expect(
        firstWebModule.match(/^import seethingSwarmWebAnimal/gmu),
      ).toHaveLength(45)
      expect(firstNativeModule.match(/require\("\.\/assets\//gu)).toHaveLength(
        45,
      )
      expect(firstWebModule).not.toContain(paths.repositoryRoot)
      expect(firstNativeModule).not.toContain(paths.repositoryRoot)
      expect(await readGeneratedModule(paths.webOutputRoot)).toBe(
        firstWebModule,
      )
      expect(await readGeneratedModule(paths.nativeOutputRoot)).toBe(
        firstNativeModule,
      )
      expect(await listRelativeFiles(paths.webOutputRoot)).toEqual(
        firstWebFiles,
      )
      expect(await listRelativeFiles(paths.nativeOutputRoot)).toEqual(
        firstNativeFiles,
      )
    },
    FULL_CUSTODY_INTEGRATION_TEST_TIMEOUT_MS,
  )

  it.each([
    "registry-only",
    "staging-only",
    "registry-and-staging",
    "staging-and-receipt",
  ] as const)("rejects partial custody state %s", async (custodyState) => {
    const paths = await createWorkspace()
    if (
      custodyState === "registry-only" ||
      custodyState === "registry-and-staging"
    ) {
      await writeRelativeFile(
        dirname(paths.registryPath),
        "registry.json",
        "{}",
      )
    }
    if (custodyState !== "registry-only") {
      await mkdir(paths.stagingRoot, { recursive: true })
    }
    if (custodyState === "staging-and-receipt") {
      await writeFile(paths.receiptPath, "{}")
    }

    await expect(
      prepareSeethingSwarmPresentationAssets(paths, moduleGenerators),
    ).rejects.toThrow("Partial SeethingSwarm presentation custody")
  })

  it("rejects a selected strip changed after the verified receipt while preserving prior output", async () => {
    const paths = await createWorkspace()
    const fixture = await createCompleteCustody(paths)
    await Promise.all([
      writeRelativeFile(paths.webOutputRoot, "sentinel.txt", "prior-web"),
      writeRelativeFile(paths.nativeOutputRoot, "sentinel.txt", "prior-native"),
    ])
    await writeRelativeFile(
      paths.stagingRoot,
      fixture.selectedPaths[0]!,
      "altered",
    )

    await expect(
      prepareSeethingSwarmPresentationAssets(paths, moduleGenerators),
    ).rejects.toThrow(
      `Altered selected SeethingSwarm asset: ${fixture.selectedPaths[0]}`,
    )
    await expect(
      readFile(join(paths.webOutputRoot, "sentinel.txt"), "utf8"),
    ).resolves.toBe("prior-web")
    await expect(
      readFile(join(paths.nativeOutputRoot, "sentinel.txt"), "utf8"),
    ).resolves.toBe("prior-native")
    await Promise.all([
      expectNoPreparedSiblings(paths.webOutputRoot),
      expectNoPreparedSiblings(paths.nativeOutputRoot),
    ])
  })

  it("rejects a selected calm strip omitted from an otherwise valid receipt", async () => {
    const paths = await createWorkspace()
    const fixture = await createCompleteCustody(paths)
    const missingPath = fixture.selectedPaths[0]!
    const receipt = rebuildReceipt(fixture.receipt, {
      assets: Object.freeze(
        fixture.receipt.assets.filter(
          ({ relativePath }) => relativePath !== missingPath,
        ),
      ),
    })
    await writeFile(paths.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)

    await expect(
      prepareSeethingSwarmPresentationAssets(paths, moduleGenerators),
    ).rejects.toThrow(
      `Missing selected SeethingSwarm receipt asset: ${missingPath}`,
    )
  })

  it("rejects registry and receipt evidence from different snapshots", async () => {
    const paths = await createWorkspace()
    const fixture = await createCompleteCustody(paths)
    const receipt = rebuildReceipt(fixture.receipt, {
      evidenceSnapshotId: "seethingswarm-animals:different-snapshot",
    })
    await writeFile(paths.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)

    await expect(
      prepareSeethingSwarmPresentationAssets(paths, moduleGenerators),
    ).rejects.toThrow("Mismatched SeethingSwarm registry and receipt snapshots")
  })

  it("rejects a symbolic link substituted for a selected licensed strip", async () => {
    const paths = await createWorkspace()
    const fixture = await createCompleteCustody(paths)
    const selectedPath = join(
      paths.stagingRoot,
      ...fixture.selectedPaths[0]!.split("/"),
    )
    const targetPath = join(paths.repositoryRoot, "target.png")
    await writeFile(targetPath, fixture.selectedPng)
    await unlink(selectedPath)
    try {
      await symlink(targetPath, selectedPath, "file")
    } catch (error: unknown) {
      expect(error).toMatchObject({ code: "EPERM" })
      return
    }

    await expect(
      prepareSeethingSwarmPresentationAssets(paths, moduleGenerators),
    ).rejects.toThrow("Invalid SeethingSwarm presentation file")
  })

  it("preserves prior platform trees when module generation fails before publication", async () => {
    const paths = await createWorkspace()
    await Promise.all([
      writeRelativeFile(paths.webOutputRoot, "sentinel.txt", "prior-web"),
      writeRelativeFile(paths.nativeOutputRoot, "sentinel.txt", "prior-native"),
    ])

    await expect(
      prepareSeethingSwarmPresentationAssets(paths, {
        web: () => "export const web = true\n",
        native: () => {
          throw new Error("synthetic generator failure")
        },
      }),
    ).rejects.toThrow("synthetic generator failure")
    await expect(
      readFile(join(paths.webOutputRoot, "sentinel.txt"), "utf8"),
    ).resolves.toBe("prior-web")
    await expect(
      readFile(join(paths.nativeOutputRoot, "sentinel.txt"), "utf8"),
    ).resolves.toBe("prior-native")
  })

  it.each([
    ["web", "", "export const native = true\n"],
    ["native", "export const web = true\n", ""],
  ] as const)(
    "rejects an empty generated %s binding",
    async (_, web, native) => {
      const paths = await createWorkspace()

      await expect(
        prepareSeethingSwarmPresentationAssets(paths, {
          web: () => web,
          native: () => native,
        }),
      ).rejects.toThrow("Missing generated SeethingSwarm presentation module")
    },
  )

  it.each(["same", "nested", "staging"] as const)(
    "rejects overlapping %s presentation output trees",
    async (overlapKind) => {
      const paths = await createWorkspace()
      const invalidPaths = {
        ...paths,
        ...(overlapKind === "same"
          ? { nativeOutputRoot: paths.webOutputRoot }
          : overlapKind === "nested"
            ? { nativeOutputRoot: join(paths.webOutputRoot, "native") }
            : { webOutputRoot: join(paths.stagingRoot, "web") }),
      }

      await expect(
        prepareSeethingSwarmPresentationAssets(invalidPaths, moduleGenerators),
      ).rejects.toThrow("SeethingSwarm presentation trees must be separate")
    },
  )

  it("parses and deeply validates canonical registry and receipt documents", async () => {
    const paths = await createWorkspace()
    const fixture = await createCompleteCustody(paths)
    const registry = parseSeethingSwarmAnimalRegistryJson(
      await readFile(paths.registryPath, "utf8"),
    )
    const receipt = parseSeethingSwarmAssetReceiptJson(
      await readFile(paths.receiptPath, "utf8"),
    )

    expect(registry).toMatchObject({
      evidenceSnapshotId: SEETHING_SWARM_SOURCE_SNAPSHOT.sourceSnapshotId,
      characterAnimationCount: 774,
      auxiliaryEffectCount: 1,
    })
    expect(registry.animals).toHaveLength(45)
    expect(receipt).toEqual(fixture.receipt)
    expect(Object.isFrozen(receipt)).toBe(true)
    expect(Object.isFrozen(receipt.assets)).toBe(true)
    expect(receipt.assets.every(Object.isFrozen)).toBe(true)
  })

  it("rejects malformed registry and receipt provenance instead of inferring custody", async () => {
    expect(() => parseSeethingSwarmAnimalRegistryJson("[]")).toThrow(
      "Invalid SeethingSwarm animal registry: expected object",
    )
    expect(() =>
      parseSeethingSwarmAnimalRegistryJson(
        JSON.stringify({ evidenceSnapshotId: "wrong", animals: [] }),
      ),
    ).toThrow("Invalid SeethingSwarm registry animal count")
    expect(() => parseSeethingSwarmAssetReceiptJson("[]")).toThrow(
      "Invalid SeethingSwarm asset receipt: expected object",
    )
    expect(() =>
      parseSeethingSwarmAssetReceiptJson(
        JSON.stringify({ schemaVersion: 999 }),
      ),
    ).toThrow("Invalid SeethingSwarm receipt schema version")
  })

  it("rejects malformed registry fields before they can define licensed custody", () => {
    const validRegistry = createRegistryDocument().registry
    const firstAnimal = validRegistry.animals[0]!
    const remainingAnimals = validRegistry.animals.slice(1)
    const invalidRegistries = [
      {
        registry: { ...validRegistry, animals: "not-an-array" },
        message: "Invalid animal registry: animals",
      },
      {
        registry: {
          ...validRegistry,
          animals: [{ ...firstAnimal, familyId: "" }, ...remainingAnimals],
        },
        message: "Invalid animal registry: familyId",
      },
      {
        registry: {
          ...validRegistry,
          animals: [{ ...firstAnimal, frameWidth: 0 }, ...remainingAnimals],
        },
        message: "Invalid animal registry: frameWidth",
      },
      {
        registry: {
          ...validRegistry,
          animals: [
            { ...firstAnimal, animalId: "not-a-zoo-animal" },
            ...remainingAnimals,
          ],
        },
        message: "Invalid animal registry animalId: not-a-zoo-animal",
      },
      {
        registry: {
          ...validRegistry,
          evidenceSnapshotId: "seethingswarm-animals:different-snapshot",
        },
        message: "Mismatched SeethingSwarm registry snapshot",
      },
    ]

    for (const { registry, message } of invalidRegistries) {
      expect(() =>
        parseSeethingSwarmAnimalRegistryJson(JSON.stringify(registry)),
      ).toThrow(message)
    }
  })

  it("rejects malformed receipt ordering hashes counts totals and aggregate evidence", async () => {
    const paths = await createWorkspace()
    const fixture = await createCompleteCustody(paths)
    const firstAsset = fixture.receipt.assets[0]!
    const secondAsset = fixture.receipt.assets[1]!
    const invalidReceipts = [
      {
        receipt: {
          ...fixture.receipt,
          assets: [secondAsset, firstAsset, ...fixture.receipt.assets.slice(2)],
        },
        message: "Unsorted SeethingSwarm receipt asset",
      },
      {
        receipt: {
          ...fixture.receipt,
          assets: [firstAsset, firstAsset, ...fixture.receipt.assets.slice(2)],
        },
        message: "Duplicate SeethingSwarm receipt asset",
      },
      {
        receipt: {
          ...fixture.receipt,
          assets: [
            { ...firstAsset, sha256: "not-a-sha256" },
            ...fixture.receipt.assets.slice(1),
          ],
        },
        message: "Invalid SeethingSwarm receipt SHA-256",
      },
      {
        receipt: {
          ...fixture.receipt,
          generatedModules: {
            ...fixture.receipt.generatedModules,
            web: {
              ...fixture.receipt.generatedModules.web,
              sha256: "not-a-sha256",
            },
          },
        },
        message: "Invalid SeethingSwarm web module SHA-256",
      },
      {
        receipt: { ...fixture.receipt, assetCount: 1 },
        message: "Invalid SeethingSwarm receipt asset count",
      },
      {
        receipt: { ...fixture.receipt, totalBytes: 1 },
        message: "Invalid SeethingSwarm receipt byte total",
      },
      {
        receipt: {
          ...fixture.receipt,
          aggregateSha256: "0".repeat(64),
        },
        message: "Invalid SeethingSwarm receipt aggregate SHA-256",
      },
    ]

    for (const { receipt, message } of invalidReceipts) {
      expect(() =>
        parseSeethingSwarmAssetReceiptJson(JSON.stringify(receipt)),
      ).toThrow(message)
    }
  })

  it("propagates unexpected custody inspection failures", async () => {
    const paths = await createWorkspace()

    await expect(
      prepareSeethingSwarmPresentationAssets(
        { ...paths, registryPath: `${paths.registryPath}\0invalid` },
        moduleGenerators,
      ),
    ).rejects.toMatchObject({ code: "ERR_INVALID_ARG_VALUE" })
  })

  it("rejects a directory substituted for the custody registry file", async () => {
    const paths = await createWorkspace()
    await Promise.all([
      mkdir(paths.registryPath, { recursive: true }),
      mkdir(paths.stagingRoot, { recursive: true }),
    ])
    await writeFile(paths.receiptPath, "{}")

    await expect(
      prepareSeethingSwarmPresentationAssets(paths, moduleGenerators),
    ).rejects.toThrow("Invalid SeethingSwarm presentation file")
  })
})

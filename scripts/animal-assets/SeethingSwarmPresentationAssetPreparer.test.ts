import {
  mkdir,
  readdir,
  readFile,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises"
import { dirname, join } from "node:path"
import { SEETHING_SWARM_SOURCE_SNAPSHOT } from "#game/data/src/SeethingSwarmSourceEvidence"
import { afterEach, describe, expect, it } from "vitest"
import {
  parseSeethingSwarmAnimalRegistryJson,
  parseSeethingSwarmAssetReceiptJson,
  prepareSeethingSwarmPresentationAssets,
  SEETHING_SWARM_RUNTIME_CLIP_CATALOG_MODULE_FILE_NAME,
} from "./SeethingSwarmPresentationAssetPreparer"
import {
  cleanUpSeethingSwarmPresentationTestWorkspaces,
  createCompleteSeethingSwarmPresentationCustody as createCompleteCustody,
  createSeethingSwarmPresentationRegistryFixture as createRegistryDocument,
  createSeethingSwarmPresentationTestWorkspace as createWorkspace,
  listSeethingSwarmPresentationTestFiles as listRelativeFiles,
  seethingSwarmPresentationModuleGenerators as moduleGenerators,
  rebuildSeethingSwarmPresentationReceipt as rebuildReceipt,
  writeSeethingSwarmPresentationTestFile as writeRelativeFile,
} from "./SeethingSwarmPresentationAssetPreparer.test-fixture"

const FULL_CUSTODY_INTEGRATION_TEST_TIMEOUT_MS = 60_000

afterEach(async () => {
  await cleanUpSeethingSwarmPresentationTestWorkspaces()
})

async function readGeneratedModule(outputRoot: string) {
  return readFile(
    join(outputRoot, SEETHING_SWARM_RUNTIME_CLIP_CATALOG_MODULE_FILE_NAME),
    "utf8",
  )
}

async function expectNoPreparedSiblings(outputRoot: string) {
  const outputParent = dirname(outputRoot)
  expect(
    (await readdir(outputParent)).filter((entry) =>
      entry.startsWith(
        `.${SEETHING_SWARM_RUNTIME_CLIP_CATALOG_MODULE_FILE_NAME}.`,
      ),
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
      SEETHING_SWARM_RUNTIME_CLIP_CATALOG_MODULE_FILE_NAME,
    ])
    expect(await listRelativeFiles(paths.nativeOutputRoot)).toEqual([
      SEETHING_SWARM_RUNTIME_CLIP_CATALOG_MODULE_FILE_NAME,
    ])
    expect(await readGeneratedModule(paths.webOutputRoot)).toBe(firstWebModule)
    expect(await readGeneratedModule(paths.nativeOutputRoot)).toBe(
      firstNativeModule,
    )
    expect(firstWebModule).toContain(
      "createSeethingSwarmTypographyOnlyRuntimeClipCatalog",
    )
    expect(firstNativeModule).toContain(
      "createSeethingSwarmTypographyOnlyRuntimeClipCatalog",
    )
    expect(firstWebModule).not.toContain("./assets/")
    expect(firstNativeModule).not.toContain("./assets/")
  })

  it(
    "copies all 775 receipt-verified runtime strips into deterministic platform trees",
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

      expect(firstResult).toEqual({ mode: "licensed", assetCount: 775 })
      expect(secondResult).toEqual(firstResult)
      expect(Object.isFrozen(firstResult)).toBe(true)
      expect(firstWebFiles).toHaveLength(776)
      expect(firstNativeFiles).toHaveLength(776)
      expect(
        firstWebFiles.filter((relativePath) => relativePath.endsWith(".png")),
      ).toEqual(
        fixture.allAssetPaths.map((path) => `assets/${path}`).toSorted(),
      )
      expect(
        firstNativeFiles.filter((relativePath) =>
          relativePath.endsWith(".png"),
        ),
      ).toEqual(
        fixture.allAssetPaths.map((path) => `assets/${path}`).toSorted(),
      )
      expect(
        firstWebModule.match(/^import seethingSwarmWebClip/gmu),
      ).toHaveLength(775)
      expect(firstNativeModule.match(/require\("\.\/assets\//gu)).toHaveLength(
        775,
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

  it("rejects a runtime strip changed after the verified receipt while preserving prior output", async () => {
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
      `Altered SeethingSwarm runtime asset: ${fixture.selectedPaths[0]}`,
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

  it("rejects a runtime strip omitted from an otherwise valid receipt", async () => {
    const paths = await createWorkspace()
    const fixture = await createCompleteCustody(paths)
    const missingPath = fixture.selectedPaths[0]!
    const missingAsset = fixture.receipt.assets.find(
      ({ relativePath }) => relativePath === missingPath,
    )!
    const receipt = rebuildReceipt(fixture.receipt, {
      assets: Object.freeze(
        [
          ...fixture.receipt.assets.filter(
            ({ relativePath }) => relativePath !== missingPath,
          ),
          {
            ...missingAsset,
            relativePath: "zz_unreferenced/extra_strip1.png",
          },
        ].toSorted((first, second) =>
          first.relativePath.localeCompare(second.relativePath),
        ),
      ),
    })
    await writeFile(paths.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)

    await expect(
      prepareSeethingSwarmPresentationAssets(paths, moduleGenerators),
    ).rejects.toThrow(
      `Missing SeethingSwarm runtime receipt asset: ${missingPath}`,
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
      ).rejects.toThrow("Missing generated SeethingSwarm runtime clip module")
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

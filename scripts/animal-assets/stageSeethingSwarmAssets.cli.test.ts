import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  parseSeethingSwarmStagingCliArguments,
  resolveSeethingSwarmStagingOutputPath,
  runSeethingSwarmStagingCli,
  SEETHING_SWARM_PRIVATE_OUTPUT_FILES,
} from "./stageSeethingSwarmAssets.cli"

const dependencyMocks = vi.hoisted(() => ({
  validateSnapshot: vi.fn(),
  generateRegistry: vi.fn(),
  stageAssets: vi.fn(),
  createLicensedAdapter: vi.fn(),
  generateWebModule: vi.fn(),
  generateNativeModule: vi.fn(),
  createReceipt: vi.fn(),
  serializeReceipt: vi.fn(),
}))

vi.mock("./SeethingSwarmSnapshotValidator", () => ({
  validateSeethingSwarmSnapshot: dependencyMocks.validateSnapshot,
}))

vi.mock("./SeethingSwarmRegistryGenerator", () => ({
  generateSeethingSwarmAnimalRegistry: dependencyMocks.generateRegistry,
}))

vi.mock("./SeethingSwarmAssetStager", async (importOriginal) => {
  const actualModule =
    await importOriginal<typeof import("./SeethingSwarmAssetStager")>()
  return {
    ...actualModule,
    stageSeethingSwarmAssets: dependencyMocks.stageAssets,
  }
})

vi.mock("#game/data/src/SeethingSwarmStaticAssetAdapter", () => ({
  createSeethingSwarmLicensedStaticAssetAdapter:
    dependencyMocks.createLicensedAdapter,
}))

vi.mock("./SeethingSwarmWebAssetModuleGenerator", () => ({
  generateSeethingSwarmWebAssetModule: dependencyMocks.generateWebModule,
}))

vi.mock("./SeethingSwarmNativeAssetModuleGenerator", () => ({
  generateSeethingSwarmNativeAssetModule: dependencyMocks.generateNativeModule,
}))

vi.mock("./SeethingSwarmAssetReceipt", () => ({
  createSeethingSwarmAssetReceipt: dependencyMocks.createReceipt,
  serializeSeethingSwarmAssetReceipt: dependencyMocks.serializeReceipt,
}))

const webModuleSource = "export const webSources = Object.freeze([])\n"
const nativeModuleSource = "export const nativeSources = Object.freeze([])\n"
const serializedReceipt = '{"aggregateSha256":"receipt-hash"}\n'
const generatedRegistry = Object.freeze({ animals: Object.freeze([]) })
const stagedAssets = Object.freeze(
  Array.from({ length: 775 }, (_, index) =>
    Object.freeze({
      relativePath: `pack_${index.toString().padStart(4, "0")}/animation.png`,
      byteLength: 1,
      sha256: index.toString(16).padStart(64, "0"),
    }),
  ),
)
const stagingResult = Object.freeze({
  evidenceSnapshotId: "validated-snapshot",
  assets: stagedAssets,
  totalBytes: 775,
})
const validatedSnapshot = Object.freeze({
  evidenceSnapshotId: "validated-snapshot",
  characterAnimations: Object.freeze(
    Array.from({ length: 774 }, (_, index) =>
      Object.freeze({ relativePath: `character_${index}.png` }),
    ),
  ),
  auxiliaryEffects: Object.freeze([
    Object.freeze({ relativePath: "effect.png" }),
  ]),
  excludedAnimations: Object.freeze(
    Array.from({ length: 102 }, (_, index) =>
      Object.freeze({ relativePath: `excluded_${index}.png` }),
    ),
  ),
})

const temporaryDirectories: string[] = []

beforeEach(() => {
  dependencyMocks.validateSnapshot
    .mockReset()
    .mockResolvedValue(validatedSnapshot)
  dependencyMocks.generateRegistry.mockReset().mockReturnValue(
    Object.freeze({
      registry: generatedRegistry,
      serializedRegistry: "{}\n",
    }),
  )
  dependencyMocks.stageAssets
    .mockReset()
    .mockImplementation(async (_sourceRoot: string, preparedRoot: string) => {
      await mkdir(preparedRoot, { recursive: true })
      await writeFile(join(preparedRoot, "staged-sentinel.png"), "staged")
      return stagingResult
    })
  dependencyMocks.createLicensedAdapter.mockReset().mockImplementation(
    (
      _registry: unknown,
      sources: readonly Readonly<{
        relativePath: string
        asset: string
      }>[],
    ) => Object.freeze({ mode: "licensed", sources: Object.freeze(sources) }),
  )
  dependencyMocks.generateWebModule.mockReset().mockReturnValue(webModuleSource)
  dependencyMocks.generateNativeModule
    .mockReset()
    .mockReturnValue(nativeModuleSource)
  dependencyMocks.createReceipt.mockReset().mockResolvedValue(
    Object.freeze({
      aggregateSha256: "receipt-hash",
    }),
  )
  dependencyMocks.serializeReceipt
    .mockReset()
    .mockReturnValue(serializedReceipt)
})

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function createTemporaryRepository() {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "wayvm-staging-cli-"))
  temporaryDirectories.push(repositoryRoot)
  return repositoryRoot
}

describe("SeethingSwarm staging CLI", () => {
  it("requires one explicit source root and applies the guarded default output", () => {
    expect(
      parseSeethingSwarmStagingCliArguments([
        "--source-root",
        "private-source",
      ]),
    ).toEqual({
      sourceRoot: "private-source",
      outputPath: "vendor/seethingswarm/assets",
    })
    expect(
      parseSeethingSwarmStagingCliArguments([
        "--output",
        "vendor/seethingswarm/custom-assets",
        "--source-root",
        "private-source",
      ]),
    ).toEqual({
      sourceRoot: "private-source",
      outputPath: "vendor/seethingswarm/custom-assets",
    })
  })

  it.each([
    ["no arguments", [], "Missing required --source-root option"],
    [
      "a source option without a value",
      ["--source-root"],
      "Missing value for --source-root",
    ],
    [
      "an output option without a value",
      ["--source-root", "private-source", "--output"],
      "Missing value for --output",
    ],
    [
      "an unknown option",
      ["--source-root", "private-source", "--mystery", "value"],
      "Unknown SeethingSwarm staging option",
    ],
    [
      "duplicate source roots",
      ["--source-root", "private-source", "--source-root", "other-source"],
      "Duplicate --source-root option",
    ],
    [
      "duplicate outputs",
      [
        "--source-root",
        "private-source",
        "--output",
        "vendor/seethingswarm/first",
        "--output",
        "vendor/seethingswarm/second",
      ],
      "Duplicate --output option",
    ],
  ] satisfies readonly [string, readonly string[], string][])(
    "rejects %s",
    (_, arguments_, expectedMessage) => {
      expect(() => parseSeethingSwarmStagingCliArguments(arguments_)).toThrow(
        expectedMessage,
      )
    },
  )

  it("rejects every output outside ignored SeethingSwarm custody", async () => {
    const repositoryRoot = await createTemporaryRepository()
    const invalidOutputPaths = [
      "assets",
      "../assets",
      "vendor",
      "vendor/seethingswarm",
      "vendor/seethingswarm/../assets",
      join(repositoryRoot, "outside"),
    ]

    for (const outputPath of invalidOutputPaths) {
      expect(() =>
        resolveSeethingSwarmStagingOutputPath(repositoryRoot, outputPath),
      ).toThrow(
        "SeethingSwarm staging output must be beneath vendor/seethingswarm/",
      )
    }
  })

  it("publishes all generated outputs while reporting only verified totals", async () => {
    const repositoryRoot = await createTemporaryRepository()
    const privateSourceRoot = join(repositoryRoot, "private-source")
    const statusMessages: string[] = []

    const result = await runSeethingSwarmStagingCli(
      ["--source-root", privateSourceRoot],
      repositoryRoot,
      (message) => statusMessages.push(message),
    )
    const outputRoot = join(repositoryRoot, "vendor", "seethingswarm", "assets")

    expect(result).toEqual({
      assetCount: 775,
      totalBytes: 775,
      aggregateSha256: "receipt-hash",
    })
    expect(validatedSnapshot.characterAnimations).toHaveLength(774)
    expect(validatedSnapshot.auxiliaryEffects).toHaveLength(1)
    expect(validatedSnapshot.excludedAnimations).toHaveLength(102)
    expect(dependencyMocks.validateSnapshot).toHaveBeenCalledWith(
      privateSourceRoot,
    )
    expect(dependencyMocks.stageAssets).toHaveBeenCalledWith(
      privateSourceRoot,
      expect.stringContaining(".assets."),
      validatedSnapshot,
    )
    expect(dependencyMocks.createLicensedAdapter).toHaveBeenCalledWith(
      generatedRegistry,
      expect.arrayContaining([
        {
          relativePath: "pack_0000/animation.png",
          asset: "pack_0000/animation.png",
        },
      ]),
    )
    expect(statusMessages).toEqual([
      "Staged 775 verified SeethingSwarm assets totaling 775 bytes for static web and native bundlers.\n",
    ])
    expect(statusMessages.join("")).not.toContain(privateSourceRoot)
    expect((await readdir(outputRoot)).toSorted()).toEqual([
      SEETHING_SWARM_PRIVATE_OUTPUT_FILES.nativeModule,
      SEETHING_SWARM_PRIVATE_OUTPUT_FILES.webModule,
      "staged-sentinel.png",
      SEETHING_SWARM_PRIVATE_OUTPUT_FILES.receipt,
    ])
    expect(
      await readFile(
        join(outputRoot, SEETHING_SWARM_PRIVATE_OUTPUT_FILES.webModule),
        "utf8",
      ),
    ).toBe(webModuleSource)
    expect(
      await readFile(
        join(outputRoot, SEETHING_SWARM_PRIVATE_OUTPUT_FILES.nativeModule),
        "utf8",
      ),
    ).toBe(nativeModuleSource)
    expect(
      await readFile(
        join(outputRoot, SEETHING_SWARM_PRIVATE_OUTPUT_FILES.receipt),
        "utf8",
      ),
    ).toBe(serializedReceipt)
  })

  it("reproduces output and removes stale files on a second run", async () => {
    const repositoryRoot = await createTemporaryRepository()
    const privateSourceRoot = join(repositoryRoot, "private-source")
    const arguments_ = ["--source-root", privateSourceRoot]
    const outputRoot = join(repositoryRoot, "vendor", "seethingswarm", "assets")

    const firstResult = await runSeethingSwarmStagingCli(
      arguments_,
      repositoryRoot,
      () => undefined,
    )
    await writeFile(join(outputRoot, "stale.txt"), "stale")
    const secondResult = await runSeethingSwarmStagingCli(
      arguments_,
      repositoryRoot,
      () => undefined,
    )

    expect(secondResult).toEqual(firstResult)
    await expect(readFile(join(outputRoot, "stale.txt"))).rejects.toMatchObject(
      { code: "ENOENT" },
    )
    expect(
      await readFile(
        join(outputRoot, SEETHING_SWARM_PRIVATE_OUTPUT_FILES.receipt),
        "utf8",
      ),
    ).toBe(serializedReceipt)
  })

  it("redacts private paths and leaves prior output intact after failure", async () => {
    const repositoryRoot = await createTemporaryRepository()
    const privateSourceRoot = join(repositoryRoot, "private-source")
    const outputRoot = join(repositoryRoot, "vendor", "seethingswarm", "assets")
    await mkdir(outputRoot, { recursive: true })
    await writeFile(join(outputRoot, "sentinel.txt"), "prior")
    dependencyMocks.generateWebModule.mockImplementationOnce(() => {
      throw new Error(`Cannot generate from ${privateSourceRoot}`)
    })

    let caughtError: unknown
    try {
      await runSeethingSwarmStagingCli(
        ["--source-root", privateSourceRoot],
        repositoryRoot,
      )
    } catch (error: unknown) {
      caughtError = error
    }

    expect(caughtError).toBeInstanceOf(Error)
    expect((caughtError as Error).message).toContain("[private source root]")
    expect((caughtError as Error).message).not.toContain(privateSourceRoot)
    expect(await readFile(join(outputRoot, "sentinel.txt"), "utf8")).toBe(
      "prior",
    )
    expect(
      (await readdir(dirname(outputRoot))).filter((entry) =>
        entry.startsWith(".assets."),
      ),
    ).toEqual([])
  })
})

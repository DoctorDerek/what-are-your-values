import { mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  parseSeethingSwarmRegistryCliArguments,
  resolveSeethingSwarmRegistryOutputPath,
  runSeethingSwarmRegistryCli,
  writeSeethingSwarmRegistryAtomically,
} from "./generateSeethingSwarmRegistry.cli"

const dependencyMocks = vi.hoisted(() => ({
  validateSnapshot: vi.fn(),
  generateRegistry: vi.fn(),
}))

vi.mock("./SeethingSwarmSnapshotValidator", () => ({
  validateSeethingSwarmSnapshot: dependencyMocks.validateSnapshot,
}))

vi.mock("./SeethingSwarmRegistryGenerator", () => ({
  generateSeethingSwarmAnimalRegistry: dependencyMocks.generateRegistry,
}))

const serializedRegistry = '{"animals":[],"verified":true}\n'
const temporaryDirectories: string[] = []

beforeEach(() => {
  dependencyMocks.validateSnapshot
    .mockReset()
    .mockResolvedValue(
      Object.freeze({ evidenceSnapshotId: "validated-snapshot" }),
    )
  dependencyMocks.generateRegistry.mockReset().mockReturnValue(
    Object.freeze({
      registry: Object.freeze({
        animals: Object.freeze(
          Array.from({ length: 45 }, (_, animalIndex) =>
            Object.freeze({ animalId: `animal_${animalIndex}` }),
          ),
        ),
        characterAnimationCount: 774,
        auxiliaryEffectCount: 1,
      }),
      serializedRegistry,
    }),
  )
})

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function createTemporaryRepository() {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "wayvm-cli-"))
  temporaryDirectories.push(repositoryRoot)
  return repositoryRoot
}

describe("SeethingSwarm registry CLI", () => {
  it("requires one explicit source root and applies the guarded default output", () => {
    expect(
      parseSeethingSwarmRegistryCliArguments([
        "--source-root",
        "private-source",
      ]),
    ).toEqual({
      sourceRoot: "private-source",
      outputPath: "vendor/seethingswarm/registry.json",
    })
    expect(
      parseSeethingSwarmRegistryCliArguments([
        "--output",
        "vendor/custom/animals.json",
        "--source-root",
        "private-source",
      ]),
    ).toEqual({
      sourceRoot: "private-source",
      outputPath: "vendor/custom/animals.json",
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
      "Unknown SeethingSwarm registry option",
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
        "vendor/first.json",
        "--output",
        "vendor/second.json",
      ],
      "Duplicate --output option",
    ],
  ] satisfies readonly [string, readonly string[], string][])(
    "rejects %s",
    (_, arguments_, expectedMessage) => {
      expect(() => parseSeethingSwarmRegistryCliArguments(arguments_)).toThrow(
        expectedMessage,
      )
    },
  )

  it("rejects every output that is not a JSON file beneath vendor", async () => {
    const repositoryRoot = await createTemporaryRepository()
    const invalidOutputPaths = [
      "registry.json",
      "../registry.json",
      "vendor",
      "vendor/registry.txt",
      "vendor/../registry.json",
      join(repositoryRoot, "outside.json"),
    ]

    for (const outputPath of invalidOutputPaths) {
      expect(() =>
        resolveSeethingSwarmRegistryOutputPath(repositoryRoot, outputPath),
      ).toThrow(
        "SeethingSwarm registry output must be a JSON file beneath vendor/",
      )
    }
  })

  it("writes valid output byte for byte and replaces it atomically", async () => {
    const repositoryRoot = await createTemporaryRepository()
    const outputPath = "vendor/seethingswarm/registry.json"

    await writeSeethingSwarmRegistryAtomically(
      repositoryRoot,
      outputPath,
      "first registry\n",
    )
    await writeSeethingSwarmRegistryAtomically(
      repositoryRoot,
      outputPath,
      serializedRegistry,
    )

    const absoluteOutputPath = join(repositoryRoot, ...outputPath.split("/"))
    expect(await readFile(absoluteOutputPath, "utf8")).toBe(serializedRegistry)
    expect(await readdir(join(repositoryRoot, "vendor/seethingswarm"))).toEqual(
      ["registry.json"],
    )
  })

  it("removes temporary output when atomic replacement fails", async () => {
    const repositoryRoot = await createTemporaryRepository()
    const outputDirectory = join(repositoryRoot, "vendor/seethingswarm")
    const conflictingOutputPath = join(outputDirectory, "registry.json")
    await mkdir(conflictingOutputPath, { recursive: true })

    await expect(
      writeSeethingSwarmRegistryAtomically(
        repositoryRoot,
        "vendor/seethingswarm/registry.json",
        serializedRegistry,
      ),
    ).rejects.toThrow()
    expect(await readdir(outputDirectory)).toEqual(["registry.json"])
  })

  it("generates the guarded output while reporting counts instead of paths", async () => {
    const repositoryRoot = await createTemporaryRepository()
    const privateSourceRoot = join(repositoryRoot, "private-source")
    const statusMessages: string[] = []

    const result = await runSeethingSwarmRegistryCli(
      ["--source-root", privateSourceRoot],
      repositoryRoot,
      (message) => statusMessages.push(message),
    )

    expect(result).toEqual({
      animalCount: 45,
      characterAnimationCount: 774,
      auxiliaryEffectCount: 1,
    })
    expect(dependencyMocks.validateSnapshot).toHaveBeenCalledWith(
      privateSourceRoot,
    )
    expect(statusMessages).toEqual([
      "Generated 45 animals, 774 character animations, and 1 auxiliary effect.\n",
    ])
    expect(statusMessages.join("")).not.toContain(privateSourceRoot)
    expect(
      await readFile(
        join(repositoryRoot, "vendor/seethingswarm/registry.json"),
        "utf8",
      ),
    ).toBe(serializedRegistry)
  })

  it("redacts the private source root from generation failures", async () => {
    const repositoryRoot = await createTemporaryRepository()
    const privateSourceRoot = join(repositoryRoot, "private-source")
    dependencyMocks.validateSnapshot.mockRejectedValueOnce(
      new Error(`Cannot read ${privateSourceRoot}`),
    )

    let caughtError: unknown
    try {
      await runSeethingSwarmRegistryCli(
        ["--source-root", privateSourceRoot],
        repositoryRoot,
      )
    } catch (error: unknown) {
      caughtError = error
    }

    expect(caughtError).toBeInstanceOf(Error)
    expect((caughtError as Error).message).toContain("[private source root]")
    expect((caughtError as Error).message).not.toContain(privateSourceRoot)
  })
})

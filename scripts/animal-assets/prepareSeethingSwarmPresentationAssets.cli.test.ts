import { join, resolve } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getSeethingSwarmPresentationPreparationPaths,
  runSeethingSwarmPresentationPreparationCli,
} from "./prepareSeethingSwarmPresentationAssets.cli"

const dependencyMocks = vi.hoisted(() => ({
  prepare: vi.fn(),
}))

vi.mock("./SeethingSwarmPresentationAssetPreparer", async (importOriginal) => {
  const actualModule =
    await importOriginal<
      typeof import("./SeethingSwarmPresentationAssetPreparer")
    >()
  return {
    ...actualModule,
    prepareSeethingSwarmPresentationAssets: dependencyMocks.prepare,
  }
})

beforeEach(() => {
  dependencyMocks.prepare.mockReset()
})

describe("SeethingSwarm presentation preparation CLI", () => {
  it("owns fixed repository-local custody and generated-output paths", () => {
    const repositoryRoot = resolve("synthetic-repository")

    expect(
      getSeethingSwarmPresentationPreparationPaths(repositoryRoot),
    ).toEqual({
      registryPath: join(
        repositoryRoot,
        "vendor",
        "seethingswarm",
        "registry.json",
      ),
      stagingRoot: join(repositoryRoot, "vendor", "seethingswarm", "assets"),
      receiptPath: join(
        repositoryRoot,
        "vendor",
        "seethingswarm",
        "assets",
        "staging-receipt.json",
      ),
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
    })
  })

  it.each([
    [
      { mode: "licensed", assetCount: 45 },
      "Prepared 45 verified SeethingSwarm Hub animals for web and native builds.\n",
    ],
    [
      { mode: "typography-only", assetCount: 0 },
      "Prepared typography-only SeethingSwarm presentation bindings for web and native builds.\n",
    ],
  ] as const)(
    "reports only the verified %s preparation result",
    async (result, message) => {
      const repositoryRoot = resolve("synthetic-repository")
      const statusMessages: string[] = []
      dependencyMocks.prepare.mockResolvedValue(result)

      await expect(
        runSeethingSwarmPresentationPreparationCli(repositoryRoot, (status) =>
          statusMessages.push(status),
        ),
      ).resolves.toEqual(result)
      expect(dependencyMocks.prepare).toHaveBeenCalledWith(
        getSeethingSwarmPresentationPreparationPaths(repositoryRoot),
        { web: expect.any(Function), native: expect.any(Function) },
      )
      expect(statusMessages).toEqual([message])
      expect(statusMessages.join("")).not.toContain(repositoryRoot)
    },
  )

  it("uses the current repository and standard output when invoked without overrides", async () => {
    const result = { mode: "typography-only", assetCount: 0 } as const
    const standardOutputWrite = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true)
    dependencyMocks.prepare.mockResolvedValue(result)

    try {
      await expect(
        runSeethingSwarmPresentationPreparationCli(),
      ).resolves.toEqual(result)
      expect(dependencyMocks.prepare).toHaveBeenCalledWith(
        getSeethingSwarmPresentationPreparationPaths(process.cwd()),
        { web: expect.any(Function), native: expect.any(Function) },
      )
      expect(standardOutputWrite).toHaveBeenCalledWith(
        "Prepared typography-only SeethingSwarm presentation bindings for web and native builds.\n",
      )
    } finally {
      standardOutputWrite.mockRestore()
    }
  })

  it("redacts private staging paths from preparation failures", async () => {
    const repositoryRoot = resolve("synthetic-private-repository")
    const stagingRoot =
      getSeethingSwarmPresentationPreparationPaths(repositoryRoot).stagingRoot
    dependencyMocks.prepare.mockRejectedValue(
      new Error(`Unable to read ${join(stagingRoot, "private-pack.png")}`),
    )

    let caughtError: unknown
    try {
      await runSeethingSwarmPresentationPreparationCli(
        repositoryRoot,
        () => undefined,
      )
    } catch (error: unknown) {
      caughtError = error
    }

    expect(caughtError).toBeInstanceOf(Error)
    expect((caughtError as Error).message).toContain("[private source root]")
    expect((caughtError as Error).message).not.toContain(stagingRoot)
    expect((caughtError as Error).message).not.toContain(
      stagingRoot.replaceAll("\\", "/"),
    )
  })
})

import { createHash } from "node:crypto"
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { stageSeethingSwarmAssets } from "./SeethingSwarmAssetStager"
import type {
  SeethingSwarmValidatedAnimation,
  SeethingSwarmValidatedPngEvidence,
  SeethingSwarmValidatedSnapshot,
} from "./SeethingSwarmSnapshotValidator"

const assetPaths = Object.freeze({
  idle: "batpack_spritesheets/bat_idle_strip4.png",
  run: "batpack_spritesheets/bat_run_strip6.png",
  effect: "frogpack_spritesheets/fly_fly_strip2.png",
  excluded: "lilwarhero_spritesheets/hero_idle_strip1.png",
})

const temporaryDirectories: string[] = []

function sha256(contents: string) {
  return createHash("sha256").update(contents).digest("hex")
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

function createAnimation(
  relativePath: string,
): SeethingSwarmValidatedAnimation {
  return Object.freeze({
    relativePath,
    animationId: "idle",
    frameCount: 1,
    sourceDirectory: relativePath.split("/")[0]!,
    pngWidth: 1,
    pngHeight: 1,
    frameWidth: 1,
    frameHeight: 1,
  })
}

function createExcludedAnimation(
  relativePath: string,
): SeethingSwarmValidatedPngEvidence {
  return Object.freeze({
    relativePath,
    animationId: "idle",
    frameCount: 1,
    sourceDirectory: relativePath.split("/")[0]!,
    pngWidth: 1,
    pngHeight: 1,
  })
}

function createSnapshot(
  overrides: Partial<SeethingSwarmValidatedSnapshot> = {},
) {
  return Object.freeze({
    evidenceSnapshotId: "seethingswarm-test-snapshot",
    evidenceFiles: Object.freeze([]),
    paletteEvidence: Object.freeze([]),
    geometryEvidence: Object.freeze([]),
    characterAnimations: Object.freeze([
      createAnimation(assetPaths.run),
      createAnimation(assetPaths.idle),
    ]),
    auxiliaryEffects: Object.freeze([createAnimation(assetPaths.effect)]),
    excludedAnimations: Object.freeze([
      createExcludedAnimation(assetPaths.excluded),
    ]),
    ...overrides,
  }) satisfies SeethingSwarmValidatedSnapshot
}

async function createWorkspace() {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "wayvm-stager-test-"))
  temporaryDirectories.push(workspaceRoot)

  return Object.freeze({
    workspaceRoot,
    sourceRoot: join(workspaceRoot, "source"),
    outputRoot: join(workspaceRoot, "vendor", "seethingswarm", "assets"),
  })
}

async function writeRelativeFile(
  root: string,
  relativePath: string,
  contents: string,
) {
  const absolutePath = join(root, ...relativePath.split("/"))
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, contents)
}

async function writeCompleteSource(sourceRoot: string) {
  await Promise.all([
    writeRelativeFile(sourceRoot, assetPaths.idle, "idle"),
    writeRelativeFile(sourceRoot, assetPaths.run, "running"),
    writeRelativeFile(sourceRoot, assetPaths.effect, "fly"),
    writeRelativeFile(sourceRoot, assetPaths.excluded, "excluded"),
  ])
}

describe("SeethingSwarm asset stager", () => {
  it("atomically replaces stale output with every runtime asset", async () => {
    const workspace = await createWorkspace()
    await writeCompleteSource(workspace.sourceRoot)
    await writeRelativeFile(workspace.outputRoot, "stale.png", "stale")

    const result = await stageSeethingSwarmAssets(
      workspace.sourceRoot,
      workspace.outputRoot,
      createSnapshot(),
    )

    expect(result).toEqual({
      evidenceSnapshotId: "seethingswarm-test-snapshot",
      assets: [
        {
          relativePath: assetPaths.idle,
          byteLength: 4,
          sha256: sha256("idle"),
        },
        {
          relativePath: assetPaths.run,
          byteLength: 7,
          sha256: sha256("running"),
        },
        {
          relativePath: assetPaths.effect,
          byteLength: 3,
          sha256: sha256("fly"),
        },
      ],
      totalBytes: 14,
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.assets)).toBe(true)
    expect(result.assets.every(Object.isFrozen)).toBe(true)
    expect(
      await readFile(
        join(workspace.outputRoot, ...assetPaths.idle.split("/")),
        "utf8",
      ),
    ).toBe("idle")
    await expect(
      readFile(join(workspace.outputRoot, "stale.png")),
    ).rejects.toMatchObject({ code: "ENOENT" })
    await expect(
      readFile(join(workspace.outputRoot, ...assetPaths.excluded.split("/"))),
    ).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("preserves prior output and removes temporary files when copying fails", async () => {
    const workspace = await createWorkspace()
    await writeRelativeFile(workspace.sourceRoot, assetPaths.idle, "idle")
    await writeRelativeFile(workspace.outputRoot, "sentinel.txt", "prior")

    await expect(
      stageSeethingSwarmAssets(
        workspace.sourceRoot,
        workspace.outputRoot,
        createSnapshot(),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" })

    expect(
      await readFile(join(workspace.outputRoot, "sentinel.txt"), "utf8"),
    ).toBe("prior")
    expect(
      (await readdir(dirname(workspace.outputRoot))).filter((entry) =>
        entry.startsWith(".assets."),
      ),
    ).toEqual([])
  })

  it("rejects unsafe duplicate and excluded runtime paths", async () => {
    const traversalWorkspace = await createWorkspace()
    await expect(
      stageSeethingSwarmAssets(
        traversalWorkspace.sourceRoot,
        traversalWorkspace.outputRoot,
        createSnapshot({
          characterAnimations: Object.freeze([
            createAnimation("../outside.png"),
          ]),
          auxiliaryEffects: Object.freeze([]),
        }),
      ),
    ).rejects.toThrow("Unsafe SeethingSwarm staging path")

    const duplicateWorkspace = await createWorkspace()
    await expect(
      stageSeethingSwarmAssets(
        duplicateWorkspace.sourceRoot,
        duplicateWorkspace.outputRoot,
        createSnapshot({
          characterAnimations: Object.freeze([
            createAnimation(assetPaths.idle),
            createAnimation(assetPaths.idle.toUpperCase()),
          ]),
          auxiliaryEffects: Object.freeze([]),
        }),
      ),
    ).rejects.toThrow("Duplicate SeethingSwarm staging path")

    const excludedWorkspace = await createWorkspace()
    await expect(
      stageSeethingSwarmAssets(
        excludedWorkspace.sourceRoot,
        excludedWorkspace.outputRoot,
        createSnapshot({
          excludedAnimations: Object.freeze([
            createExcludedAnimation(assetPaths.idle),
          ]),
        }),
      ),
    ).rejects.toThrow("Excluded SeethingSwarm asset entered staging")
  })

  it("rejects a runtime asset path that resolves to a directory", async () => {
    const workspace = await createWorkspace()
    await mkdir(join(workspace.sourceRoot, ...assetPaths.idle.split("/")), {
      recursive: true,
    })

    await expect(
      stageSeethingSwarmAssets(
        workspace.sourceRoot,
        workspace.outputRoot,
        createSnapshot({
          characterAnimations: Object.freeze([
            createAnimation(assetPaths.idle),
          ]),
          auxiliaryEffects: Object.freeze([]),
        }),
      ),
    ).rejects.toThrow("SeethingSwarm asset is not a file")
  })

  it("rejects a symbolic link in place of a runtime asset", async () => {
    const workspace = await createWorkspace()
    const targetPath = join(workspace.sourceRoot, "target.png")
    const symbolicLinkPath = join(
      workspace.sourceRoot,
      ...assetPaths.idle.split("/"),
    )
    await mkdir(dirname(symbolicLinkPath), { recursive: true })
    await writeFile(targetPath, "target")
    try {
      await symlink(targetPath, symbolicLinkPath, "file")
    } catch (error: unknown) {
      expect(error).toMatchObject({ code: "EPERM" })
      return
    }

    await expect(
      stageSeethingSwarmAssets(
        workspace.sourceRoot,
        workspace.outputRoot,
        createSnapshot({
          characterAnimations: Object.freeze([
            createAnimation(assetPaths.idle),
          ]),
          auxiliaryEffects: Object.freeze([]),
        }),
      ),
    ).rejects.toThrow("Unsupported SeethingSwarm symbolic link")
  })

  it("rejects nested source and output custody trees", async () => {
    const workspace = await createWorkspace()

    await expect(
      stageSeethingSwarmAssets(
        workspace.sourceRoot,
        join(workspace.sourceRoot, "output"),
        createSnapshot(),
      ),
    ).rejects.toThrow(
      "SeethingSwarm source and staging output must use separate trees",
    )
    await expect(
      stageSeethingSwarmAssets(
        join(workspace.outputRoot, "source"),
        workspace.outputRoot,
        createSnapshot(),
      ),
    ).rejects.toThrow(
      "SeethingSwarm source and staging output must use separate trees",
    )
  })
})

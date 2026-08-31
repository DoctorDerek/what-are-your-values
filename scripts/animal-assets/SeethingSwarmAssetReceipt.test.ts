import { createHash } from "node:crypto"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import {
  createSeethingSwarmAssetReceipt,
  SEETHING_SWARM_ASSET_RECEIPT_SCHEMA_VERSION,
  serializeSeethingSwarmAssetReceipt,
} from "./SeethingSwarmAssetReceipt"
import {
  stageSeethingSwarmAssets,
  type SeethingSwarmStagingResult,
} from "./SeethingSwarmAssetStager"
import { generateSeethingSwarmNativeAssetModule } from "./SeethingSwarmNativeAssetModuleGenerator"
import type {
  SeethingSwarmValidatedAnimation,
  SeethingSwarmValidatedSnapshot,
} from "./SeethingSwarmSnapshotValidator"
import { generateSeethingSwarmWebAssetModule } from "./SeethingSwarmWebAssetModuleGenerator"

const assetPaths = Object.freeze({
  idle: "batpack_spritesheets/bat_idle_strip4.png",
  effect: "frogpack_spritesheets/fly_fly_strip2.png",
})

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

function sha256(contents: string) {
  return createHash("sha256").update(contents).digest("hex")
}

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

function createSnapshot() {
  return Object.freeze({
    evidenceSnapshotId: "seethingswarm-test-snapshot",
    evidenceFiles: Object.freeze([]),
    paletteEvidence: Object.freeze([]),
    geometryEvidence: Object.freeze([]),
    characterAnimations: Object.freeze([createAnimation(assetPaths.idle)]),
    auxiliaryEffects: Object.freeze([createAnimation(assetPaths.effect)]),
    excludedAnimations: Object.freeze([]),
  }) satisfies SeethingSwarmValidatedSnapshot
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

async function createStagedFixture() {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "wayvm-receipt-test-"))
  temporaryDirectories.push(workspaceRoot)
  const sourceRoot = join(workspaceRoot, "source")
  const stagingRoot = join(workspaceRoot, "vendor", "assets")
  await Promise.all([
    writeRelativeFile(sourceRoot, assetPaths.idle, "idle"),
    writeRelativeFile(sourceRoot, assetPaths.effect, "fly"),
  ])

  const staging = await stageSeethingSwarmAssets(
    sourceRoot,
    stagingRoot,
    createSnapshot(),
  )
  const webModuleSource = generateSeethingSwarmWebAssetModule(staging)
  const nativeModuleSource = generateSeethingSwarmNativeAssetModule(staging)

  return Object.freeze({
    stagingRoot,
    staging,
    webModuleSource,
    nativeModuleSource,
  })
}

describe("SeethingSwarm asset receipt", () => {
  it("records deterministic asset and generated-module provenance", async () => {
    const fixture = await createStagedFixture()
    const receipt = await createSeethingSwarmAssetReceipt(
      fixture.stagingRoot,
      fixture.staging,
      fixture.webModuleSource,
      fixture.nativeModuleSource,
    )

    expect(receipt).toMatchObject({
      schemaVersion: SEETHING_SWARM_ASSET_RECEIPT_SCHEMA_VERSION,
      evidenceSnapshotId: "seethingswarm-test-snapshot",
      assetCount: 2,
      totalBytes: 7,
      assets: [
        {
          relativePath: assetPaths.idle,
          byteLength: 4,
          sha256: sha256("idle"),
        },
        {
          relativePath: assetPaths.effect,
          byteLength: 3,
          sha256: sha256("fly"),
        },
      ],
      generatedModules: {
        web: {
          byteLength: Buffer.byteLength(fixture.webModuleSource),
          sha256: sha256(fixture.webModuleSource),
        },
        native: {
          byteLength: Buffer.byteLength(fixture.nativeModuleSource),
          sha256: sha256(fixture.nativeModuleSource),
        },
      },
      aggregateSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(Object.isFrozen(receipt)).toBe(true)
    expect(Object.isFrozen(receipt.assets)).toBe(true)
    expect(receipt.assets.every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(receipt.generatedModules)).toBe(true)
    expect(Object.isFrozen(receipt.generatedModules.web)).toBe(true)
    expect(Object.isFrozen(receipt.generatedModules.native)).toBe(true)

    const serializedReceipt = serializeSeethingSwarmAssetReceipt(receipt)
    expect(serializedReceipt.endsWith("\n")).toBe(true)
    expect(serializedReceipt).not.toContain(fixture.stagingRoot)
    expect(JSON.parse(serializedReceipt)).toEqual(receipt)
  })

  it("reproduces equivalent assets modules and receipts byte for byte", async () => {
    const firstFixture = await createStagedFixture()
    const secondFixture = await createStagedFixture()
    const firstReceipt = await createSeethingSwarmAssetReceipt(
      firstFixture.stagingRoot,
      firstFixture.staging,
      firstFixture.webModuleSource,
      firstFixture.nativeModuleSource,
    )
    const secondReceipt = await createSeethingSwarmAssetReceipt(
      secondFixture.stagingRoot,
      secondFixture.staging,
      secondFixture.webModuleSource,
      secondFixture.nativeModuleSource,
    )

    expect(firstFixture.webModuleSource).toBe(secondFixture.webModuleSource)
    expect(firstFixture.nativeModuleSource).toBe(
      secondFixture.nativeModuleSource,
    )
    expect(serializeSeethingSwarmAssetReceipt(firstReceipt)).toBe(
      serializeSeethingSwarmAssetReceipt(secondReceipt),
    )
  })

  it("rejects a staged asset altered after verified copying", async () => {
    const fixture = await createStagedFixture()
    await writeRelativeFile(fixture.stagingRoot, assetPaths.idle, "IDLE")

    await expect(
      createSeethingSwarmAssetReceipt(
        fixture.stagingRoot,
        fixture.staging,
        fixture.webModuleSource,
        fixture.nativeModuleSource,
      ),
    ).rejects.toThrow(
      `Altered SeethingSwarm staged receipt asset: ${assetPaths.idle}`,
    )
  })

  it("rejects staged paths that no longer match verified registry ownership", async () => {
    const fixture = await createStagedFixture()
    const mismatchedStaging = Object.freeze({
      ...fixture.staging,
      assets: Object.freeze([
        fixture.staging.assets[0]!,
        Object.freeze({
          ...fixture.staging.assets[1]!,
          relativePath: "frogpack_spritesheets/missing.png",
        }),
      ]),
    }) satisfies SeethingSwarmStagingResult

    await expect(
      createSeethingSwarmAssetReceipt(
        fixture.stagingRoot,
        mismatchedStaging,
        generateSeethingSwarmWebAssetModule(mismatchedStaging),
        generateSeethingSwarmNativeAssetModule(mismatchedStaging),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" })
  })

  it.each([
    ["web", "", "native module"],
    ["native", "web module", ""],
  ])("rejects a missing %s generated module", async (_, web, native) => {
    const fixture = await createStagedFixture()

    await expect(
      createSeethingSwarmAssetReceipt(
        fixture.stagingRoot,
        fixture.staging,
        web,
        native,
      ),
    ).rejects.toThrow(`Missing SeethingSwarm ${_} generated module`)
  })
})

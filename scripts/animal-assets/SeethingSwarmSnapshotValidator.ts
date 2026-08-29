import { createHash } from "node:crypto"
import { readdir, readFile, stat } from "node:fs/promises"
import { extname, isAbsolute, relative, resolve, sep } from "node:path"
import {
  SEETHING_SWARM_SOURCE_PACKS,
  SEETHING_SWARM_SOURCE_SNAPSHOT,
  type SeethingSwarmSourceEvidenceFile,
} from "#game/data/src/SeethingSwarmSourceEvidence"
import {
  parseSeethingSwarmAnimationEvidence,
  parseSeethingSwarmGeometryEvidence,
  parseSeethingSwarmPaletteEvidence,
  type SeethingSwarmAnimationEvidence,
} from "./SeethingSwarmEvidenceParser"

const EVIDENCE_PATHS = Object.freeze({
  animations: "seethingswarm_animals_full_animation_list_with_frame_count.txt",
  palettes: "seethingswarm_animals_colors_list.txt",
  geometry: "seethingswarm_animals_spritesheet_sizes.txt",
  license: "LICENSE.txt",
})

const FROGPACK_FLY_EFFECT = Object.freeze({
  relativePath: "frogpack_spritesheets/fly_fly_strip2.png",
  effectId: "fly",
  frameWidth: 8,
  frameHeight: 6,
  frameCount: 2,
})

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

export type SeethingSwarmSnapshotExpectation = Readonly<{
  evidenceSnapshotId: string
  characterAnimationStripCount: number
  auxiliaryEffectStripCount: number
  excludedHumanWeaponStripCount: number
  totalPngStripCount: number
  evidenceFiles: readonly SeethingSwarmSourceEvidenceFile[]
  animalSourceDirectories: readonly string[]
}>

export type SeethingSwarmValidatedPngEvidence = Readonly<{
  relativePath: string
  animationId: string
  frameCount: number
  sourceDirectory: string
  pngWidth: number
  pngHeight: number
}>

export type SeethingSwarmValidatedAnimation =
  SeethingSwarmValidatedPngEvidence &
    Readonly<{
      frameWidth: number
      frameHeight: number
    }>

export type SeethingSwarmValidatedSnapshot = Readonly<{
  evidenceSnapshotId: string
  evidenceFiles: readonly SeethingSwarmSourceEvidenceFile[]
  paletteEvidence: ReturnType<typeof parseSeethingSwarmPaletteEvidence>
  geometryEvidence: ReturnType<typeof parseSeethingSwarmGeometryEvidence>
  characterAnimations: readonly SeethingSwarmValidatedAnimation[]
  auxiliaryEffects: readonly SeethingSwarmValidatedAnimation[]
  excludedAnimations: readonly SeethingSwarmValidatedPngEvidence[]
}>

function createCanonicalExpectation() {
  return Object.freeze({
    evidenceSnapshotId: SEETHING_SWARM_SOURCE_SNAPSHOT.sourceSnapshotId,
    characterAnimationStripCount:
      SEETHING_SWARM_SOURCE_SNAPSHOT.characterAnimationStripCount,
    auxiliaryEffectStripCount:
      SEETHING_SWARM_SOURCE_SNAPSHOT.auxiliaryEffectStripCount,
    excludedHumanWeaponStripCount:
      SEETHING_SWARM_SOURCE_SNAPSHOT.excludedHumanWeaponStripCount,
    totalPngStripCount: SEETHING_SWARM_SOURCE_SNAPSHOT.totalPngStripCount,
    evidenceFiles: SEETHING_SWARM_SOURCE_SNAPSHOT.evidenceFiles,
    animalSourceDirectories: Object.freeze(
      SEETHING_SWARM_SOURCE_PACKS.map(({ sourceDirectory }) => sourceDirectory),
    ),
  }) satisfies SeethingSwarmSnapshotExpectation
}

function assertPositiveSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

function assertExpectation(expectation: SeethingSwarmSnapshotExpectation) {
  if (expectation.evidenceSnapshotId.trim() === "") {
    throw new Error("Invalid SeethingSwarm evidence snapshot ID")
  }

  assertPositiveSafeInteger(
    expectation.characterAnimationStripCount,
    "expected character animation count",
  )
  assertPositiveSafeInteger(
    expectation.auxiliaryEffectStripCount,
    "expected auxiliary effect count",
  )
  assertPositiveSafeInteger(
    expectation.excludedHumanWeaponStripCount,
    "expected excluded animation count",
  )
  assertPositiveSafeInteger(
    expectation.totalPngStripCount,
    "expected PNG count",
  )

  const expectedTotal =
    expectation.characterAnimationStripCount +
    expectation.auxiliaryEffectStripCount +
    expectation.excludedHumanWeaponStripCount
  if (expectedTotal !== expectation.totalPngStripCount) {
    throw new Error(
      `Invalid SeethingSwarm expected PNG arithmetic: ${expectedTotal}`,
    )
  }

  const sourceDirectories = new Set<string>()
  for (const sourceDirectory of expectation.animalSourceDirectories) {
    if (
      !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(sourceDirectory) ||
      sourceDirectories.has(sourceDirectory)
    ) {
      throw new Error(
        `Invalid SeethingSwarm animal source directory: ${sourceDirectory}`,
      )
    }
    sourceDirectories.add(sourceDirectory)
  }

  const requiredEvidencePaths = new Set<string>(Object.values(EVIDENCE_PATHS))
  const suppliedEvidencePaths = expectation.evidenceFiles.map(
    ({ relativePath }) => relativePath,
  )
  if (
    suppliedEvidencePaths.length !== requiredEvidencePaths.size ||
    suppliedEvidencePaths.some(
      (relativePath) => !requiredEvidencePaths.has(relativePath),
    ) ||
    new Set(suppliedEvidencePaths).size !== suppliedEvidencePaths.length
  ) {
    throw new Error("Invalid SeethingSwarm evidence file set")
  }
}

function resolveSourcePath(sourceRoot: string, relativePath: string) {
  const absolutePath = resolve(sourceRoot, ...relativePath.split("/"))
  const resolvedRelativePath = relative(sourceRoot, absolutePath)
  if (
    resolvedRelativePath === ".." ||
    resolvedRelativePath.startsWith(`..${sep}`) ||
    isAbsolute(resolvedRelativePath)
  ) {
    throw new Error(`Unsafe SeethingSwarm source path: ${relativePath}`)
  }

  return absolutePath
}

async function readVerifiedEvidenceFiles(
  sourceRoot: string,
  expectation: SeethingSwarmSnapshotExpectation,
) {
  const verifiedFiles = new Map<string, Buffer>()
  for (const evidenceFile of expectation.evidenceFiles) {
    const fileBuffer = await readFile(
      resolveSourcePath(sourceRoot, evidenceFile.relativePath),
    )
    const actualHash = createHash("sha256")
      .update(fileBuffer)
      .digest("hex")
      .toUpperCase()
    if (actualHash !== evidenceFile.sha256) {
      throw new Error(
        `SeethingSwarm evidence hash mismatch: ${evidenceFile.relativePath}`,
      )
    }
    verifiedFiles.set(evidenceFile.relativePath, fileBuffer)
  }

  return verifiedFiles
}

async function collectPngPaths(
  sourceRoot: string,
  currentDirectory = sourceRoot,
  relativeDirectory = "",
): Promise<readonly string[]> {
  const pngPaths: string[] = []
  const entries = await readdir(currentDirectory, { withFileTypes: true })
  for (const entry of entries) {
    const relativePath = relativeDirectory
      ? `${relativeDirectory}/${entry.name}`
      : entry.name
    const absolutePath = resolve(currentDirectory, entry.name)

    if (entry.isSymbolicLink()) {
      throw new Error(
        `Unsupported SeethingSwarm symbolic link: ${relativePath}`,
      )
    }
    if (entry.isDirectory()) {
      pngPaths.push(
        ...(await collectPngPaths(sourceRoot, absolutePath, relativePath)),
      )
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".png") {
      pngPaths.push(relativePath)
    }
  }

  return pngPaths
}

function assertUniqueCaseInsensitivePaths(
  paths: readonly string[],
  label: string,
) {
  const comparablePaths = new Set<string>()
  for (const path of paths) {
    const comparablePath = path.toLowerCase()
    if (comparablePaths.has(comparablePath)) {
      throw new Error(`Duplicate ${label}: ${path}`)
    }
    comparablePaths.add(comparablePath)
  }
}

function assertExactPngPaths(
  animationEvidence: readonly SeethingSwarmAnimationEvidence[],
  actualPngPaths: readonly string[],
  expectedPngCount: number,
) {
  const enumeratedPngPaths = animationEvidence.map(
    ({ relativePath }) => relativePath,
  )
  assertUniqueCaseInsensitivePaths(enumeratedPngPaths, "enumerated PNG path")
  assertUniqueCaseInsensitivePaths(actualPngPaths, "source PNG path")

  if (enumeratedPngPaths.length !== expectedPngCount) {
    throw new Error(
      `Invalid SeethingSwarm enumerated PNG count: ${enumeratedPngPaths.length}`,
    )
  }
  if (actualPngPaths.length !== expectedPngCount) {
    throw new Error(
      `Invalid SeethingSwarm source PNG count: ${actualPngPaths.length}`,
    )
  }

  const enumeratedPathSet = new Set(enumeratedPngPaths)
  const actualPathSet = new Set(actualPngPaths)
  const missingPngPath = enumeratedPngPaths.find(
    (relativePath) => !actualPathSet.has(relativePath),
  )
  if (missingPngPath) {
    throw new Error(`Missing SeethingSwarm PNG: ${missingPngPath}`)
  }

  const unexpectedPngPath = actualPngPaths.find(
    (relativePath) => !enumeratedPathSet.has(relativePath),
  )
  if (unexpectedPngPath) {
    throw new Error(`Unexpected SeethingSwarm PNG: ${unexpectedPngPath}`)
  }
}

async function readPngDimensions(sourceRoot: string, relativePath: string) {
  const pngBuffer = await readFile(resolveSourcePath(sourceRoot, relativePath))
  if (
    pngBuffer.length < 24 ||
    !pngBuffer.subarray(0, pngSignature.length).equals(pngSignature) ||
    pngBuffer.readUInt32BE(8) !== 13 ||
    pngBuffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new Error(`Invalid SeethingSwarm PNG header: ${relativePath}`)
  }

  const pngWidth = pngBuffer.readUInt32BE(16)
  const pngHeight = pngBuffer.readUInt32BE(20)
  assertPositiveSafeInteger(pngWidth, `PNG width for ${relativePath}`)
  assertPositiveSafeInteger(pngHeight, `PNG height for ${relativePath}`)

  return Object.freeze({ pngWidth, pngHeight })
}

function createGeometryMap(
  geometryEvidence: ReturnType<typeof parseSeethingSwarmGeometryEvidence>,
) {
  return new Map(
    geometryEvidence.map((geometry) => [geometry.sourceRelativePath, geometry]),
  )
}

function decodeUtf8Evidence(fileBuffer: Buffer) {
  const decodedText = fileBuffer.toString("utf8")
  return decodedText.startsWith("\uFEFF") ? decodedText.slice(1) : decodedText
}

async function inspectAnimationPng(
  sourceRoot: string,
  animation: SeethingSwarmAnimationEvidence,
) {
  const sourceDirectory = animation.relativePath.split("/")[0]!
  const dimensions = await readPngDimensions(sourceRoot, animation.relativePath)

  return Object.freeze({
    ...animation,
    sourceDirectory,
    ...dimensions,
  }) satisfies SeethingSwarmValidatedPngEvidence
}

function validateAnimationGeometry(
  animation: SeethingSwarmValidatedPngEvidence,
  frameWidth: number,
  frameHeight: number,
) {
  const expectedPngWidth = frameWidth * animation.frameCount
  assertPositiveSafeInteger(
    expectedPngWidth,
    `expected PNG width for ${animation.relativePath}`,
  )
  if (animation.pngWidth !== expectedPngWidth) {
    throw new Error(
      `Invalid SeethingSwarm PNG width for ${animation.relativePath}: expected ${expectedPngWidth}, received ${animation.pngWidth}`,
    )
  }
  if (animation.pngHeight !== frameHeight) {
    throw new Error(
      `Invalid SeethingSwarm PNG height for ${animation.relativePath}: expected ${frameHeight}, received ${animation.pngHeight}`,
    )
  }

  return Object.freeze({
    ...animation,
    frameWidth,
    frameHeight,
  }) satisfies SeethingSwarmValidatedAnimation
}

function assertValidatedCounts(
  snapshot: Pick<
    SeethingSwarmValidatedSnapshot,
    "characterAnimations" | "auxiliaryEffects" | "excludedAnimations"
  >,
  expectation: SeethingSwarmSnapshotExpectation,
) {
  const counts = [
    [
      "character animation",
      snapshot.characterAnimations.length,
      expectation.characterAnimationStripCount,
    ],
    [
      "auxiliary effect",
      snapshot.auxiliaryEffects.length,
      expectation.auxiliaryEffectStripCount,
    ],
    [
      "excluded animation",
      snapshot.excludedAnimations.length,
      expectation.excludedHumanWeaponStripCount,
    ],
  ] as const

  for (const [label, actualCount, expectedCount] of counts) {
    if (actualCount !== expectedCount) {
      throw new Error(
        `Invalid SeethingSwarm ${label} count: expected ${expectedCount}, received ${actualCount}`,
      )
    }
  }
}

export async function validateSeethingSwarmSnapshotAgainstExpectation(
  sourceRoot: string,
  expectation: SeethingSwarmSnapshotExpectation,
) {
  if (sourceRoot.trim() === "") {
    throw new Error("Missing explicit SeethingSwarm source root")
  }
  assertExpectation(expectation)

  const resolvedSourceRoot = resolve(sourceRoot)
  const sourceStats = await stat(resolvedSourceRoot)
  if (!sourceStats.isDirectory()) {
    throw new Error("SeethingSwarm source root is not a directory")
  }

  const verifiedEvidenceFiles = await readVerifiedEvidenceFiles(
    resolvedSourceRoot,
    expectation,
  )
  const animationEvidence = parseSeethingSwarmAnimationEvidence(
    decodeUtf8Evidence(verifiedEvidenceFiles.get(EVIDENCE_PATHS.animations)!),
  )
  const paletteEvidence = parseSeethingSwarmPaletteEvidence(
    decodeUtf8Evidence(verifiedEvidenceFiles.get(EVIDENCE_PATHS.palettes)!),
  )
  const geometryEvidence = parseSeethingSwarmGeometryEvidence(
    decodeUtf8Evidence(verifiedEvidenceFiles.get(EVIDENCE_PATHS.geometry)!),
  )
  const actualPngPaths = await collectPngPaths(resolvedSourceRoot)

  assertExactPngPaths(
    animationEvidence,
    actualPngPaths,
    expectation.totalPngStripCount,
  )

  const geometryMap = createGeometryMap(geometryEvidence)
  const animalSourceDirectories = new Set(expectation.animalSourceDirectories)
  const characterAnimations: SeethingSwarmValidatedAnimation[] = []
  const auxiliaryEffects: SeethingSwarmValidatedAnimation[] = []
  const excludedAnimations: SeethingSwarmValidatedPngEvidence[] = []
  for (const animation of animationEvidence) {
    const inspectedAnimation = await inspectAnimationPng(
      resolvedSourceRoot,
      animation,
    )

    if (animation.relativePath === FROGPACK_FLY_EFFECT.relativePath) {
      if (
        animation.animationId !== FROGPACK_FLY_EFFECT.effectId ||
        animation.frameCount !== FROGPACK_FLY_EFFECT.frameCount
      ) {
        throw new Error(
          "Invalid SeethingSwarm Frogpack auxiliary effect metadata",
        )
      }
      auxiliaryEffects.push(
        validateAnimationGeometry(
          inspectedAnimation,
          FROGPACK_FLY_EFFECT.frameWidth,
          FROGPACK_FLY_EFFECT.frameHeight,
        ),
      )
    } else if (
      animalSourceDirectories.has(inspectedAnimation.sourceDirectory)
    ) {
      const geometry = geometryMap.get(inspectedAnimation.sourceDirectory)
      if (!geometry) {
        throw new Error(
          `Missing SeethingSwarm geometry evidence: ${inspectedAnimation.sourceDirectory}`,
        )
      }
      characterAnimations.push(
        validateAnimationGeometry(
          inspectedAnimation,
          geometry.frameWidth,
          geometry.frameHeight,
        ),
      )
    } else {
      excludedAnimations.push(inspectedAnimation)
    }
  }

  const snapshot = Object.freeze({
    evidenceSnapshotId: expectation.evidenceSnapshotId,
    evidenceFiles: Object.freeze(
      expectation.evidenceFiles.map((evidenceFile) =>
        Object.freeze({ ...evidenceFile }),
      ),
    ),
    paletteEvidence,
    geometryEvidence,
    characterAnimations: Object.freeze(characterAnimations),
    auxiliaryEffects: Object.freeze(auxiliaryEffects),
    excludedAnimations: Object.freeze(excludedAnimations),
  }) satisfies SeethingSwarmValidatedSnapshot

  assertValidatedCounts(snapshot, expectation)
  return snapshot
}

export async function validateSeethingSwarmSnapshot(sourceRoot: string) {
  return validateSeethingSwarmSnapshotAgainstExpectation(
    sourceRoot,
    createCanonicalExpectation(),
  )
}

import type {
  SeethingSwarmAnimalPresentation,
  SeethingSwarmAnimalPresentationAdapter,
} from "#game/data/src/SeethingSwarmAnimalPresentation"
import { ZOO_ANIMALS } from "#game/data/src/ZooAnimals"

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

export function assertSeethingSwarmPreparedPresentationAdapter(
  adapter: SeethingSwarmAnimalPresentationAdapter<string>,
  label: string,
) {
  if (adapter.mode === "typography-only") {
    if (Object.keys(adapter).join(",") !== "mode") {
      throw new Error(`Invalid SeethingSwarm ${label} typography-only metadata`)
    }
    return
  }
  if (adapter.evidenceSnapshotId.trim() === "") {
    throw new Error(`Missing SeethingSwarm ${label} evidence snapshot ID`)
  }
  if (adapter.animals.length !== ZOO_ANIMALS.length) {
    throw new Error(
      `Invalid SeethingSwarm ${label} presentation count: ${adapter.animals.length}`,
    )
  }

  const comparablePaths = new Set<string>()
  for (const [index, expectedAnimal] of ZOO_ANIMALS.entries()) {
    const presentation = adapter.animals[index]
    if (presentation?.animalId !== expectedAnimal.id) {
      throw new Error(
        `Invalid SeethingSwarm ${label} presentation at position ${index}: expected ${expectedAnimal.id}, received ${presentation?.animalId ?? "missing"}`,
      )
    }
    if (presentation.asset !== presentation.relativePath) {
      throw new Error(
        `Mismatched SeethingSwarm ${label} prepared asset: ${presentation.animalId}`,
      )
    }

    assertSafeRelativePngPath(presentation.asset, label)
    const comparablePath = presentation.asset.toLowerCase()
    if (comparablePaths.has(comparablePath)) {
      throw new Error(
        `Duplicate SeethingSwarm ${label} prepared asset: ${presentation.asset}`,
      )
    }
    comparablePaths.add(comparablePath)
  }
}

export function getSeethingSwarmPresentationAssetImportPath(
  relativePath: string,
) {
  return `./assets/${relativePath}`
}

export function serializeSeethingSwarmPresentationModuleEntry(
  presentation: SeethingSwarmAnimalPresentation<string>,
  assetExpression: string,
) {
  return [
    "    Object.freeze({",
    `      animalId: ${JSON.stringify(presentation.animalId)},`,
    `      animationId: ${JSON.stringify(presentation.animationId)},`,
    `      relativePath: ${JSON.stringify(presentation.relativePath)},`,
    `      frameWidth: ${presentation.frameWidth},`,
    `      frameHeight: ${presentation.frameHeight},`,
    `      frameCount: ${presentation.frameCount},`,
    "      visibleBounds: Object.freeze({",
    `        left: ${presentation.visibleBounds.left},`,
    `        top: ${presentation.visibleBounds.top},`,
    `        width: ${presentation.visibleBounds.width},`,
    `        height: ${presentation.visibleBounds.height},`,
    "      }),",
    `      integerScale: ${presentation.integerScale},`,
    `      frameOffsetX: ${presentation.frameOffsetX},`,
    `      frameOffsetY: ${presentation.frameOffsetY},`,
    `      asset: ${assetExpression},`,
    "    }),",
  ]
}

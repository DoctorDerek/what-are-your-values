import { getPairCount } from "@game/data/src/ActiveDeck"
import type { WayvmExport } from "./WayvmExport"
import { decodeWayvmExport } from "./WayvmExport"

export type WayvmImportPreview = {
  readonly exportedAt: string
  readonly sourceAppVersion: string
  readonly sourceBuild: string
  readonly saveSchemaVersion: number
  readonly canonicalCatalogVersion: string
  readonly totalComparisons: number
  readonly currentCycle: number
  readonly customValueCount: number
  readonly customValueNames: readonly string[]
  readonly activeValueCount: number
  readonly activePairCycleSize: number
  readonly deckRevision: number
  readonly progressGeneration: number
  readonly unlockedAchievementCount: number
  readonly achievementProgressGeneration: number
  readonly locale: string
  readonly replacesCurrentLocalData: true
}

export type PreparedWayvmImport = {
  readonly wayvmExport: WayvmExport
  readonly preview: WayvmImportPreview
}

function getTotalComparisons(wayvmExport: WayvmExport) {
  const valueComparisonCount = Array.from(
    wayvmExport.playerData.profile.progressById.values(),
  ).reduce((total, { profileComparisons }) => total + profileComparisons, 0)
  if (
    !Number.isSafeInteger(valueComparisonCount) ||
    valueComparisonCount % 2 !== 0
  ) {
    throw new Error("Export comparison evidence is inconsistent")
  }

  return valueComparisonCount / 2
}

function getCurrentCycle(wayvmExport: WayvmExport) {
  const cycleIndex = wayvmExport.playerData.profile.scheduler.cycleIndex
  if (cycleIndex === Number.MAX_SAFE_INTEGER) {
    throw new Error("Export cycle number cannot be represented safely")
  }

  return cycleIndex + 1
}

export function createWayvmImportPreview(
  wayvmExport: WayvmExport,
): WayvmImportPreview {
  const { playerData } = wayvmExport
  const activeValueCount = playerData.profile.activeDeck.valueIds.length

  return Object.freeze({
    exportedAt: wayvmExport.exportedAt,
    sourceAppVersion: wayvmExport.sourceAppVersion,
    sourceBuild: wayvmExport.sourceBuild,
    saveSchemaVersion: wayvmExport.saveSchemaVersion,
    canonicalCatalogVersion: wayvmExport.canonicalCatalogVersion,
    totalComparisons: getTotalComparisons(wayvmExport),
    currentCycle: getCurrentCycle(wayvmExport),
    customValueCount: playerData.profile.activeDeck.customValues.length,
    customValueNames: Object.freeze(
      playerData.profile.activeDeck.customValues.map(({ name }) => name),
    ),
    activeValueCount,
    activePairCycleSize: getPairCount(activeValueCount),
    deckRevision: wayvmExport.deckRevision,
    progressGeneration: wayvmExport.progressGeneration,
    unlockedAchievementCount: playerData.achievements.unlocks.length,
    achievementProgressGeneration:
      playerData.achievements.progress.achievementProgressGeneration,
    locale: playerData.settings.locale,
    replacesCurrentLocalData: true,
  })
}

export async function prepareWayvmImport(serialized: string) {
  const wayvmExport = await decodeWayvmExport(serialized)

  return Object.freeze({
    wayvmExport,
    preview: createWayvmImportPreview(wayvmExport),
  }) satisfies PreparedWayvmImport
}

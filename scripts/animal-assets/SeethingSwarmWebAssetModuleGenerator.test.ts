import { describe, expect, it } from "vitest"
import type { SeethingSwarmStagingResult } from "./SeethingSwarmAssetStager"
import { generateSeethingSwarmWebAssetModule } from "./SeethingSwarmWebAssetModuleGenerator"

function createStagingResult(
  paths: readonly string[] = Object.freeze([
    "batpack_spritesheets/bat_idle_strip4.png",
    "frogpack_spritesheets/fly_fly_strip2.png",
  ]),
) {
  const assets = Object.freeze(
    paths.map((relativePath, index) =>
      Object.freeze({ relativePath, byteLength: index + 1 }),
    ),
  )

  return Object.freeze({
    evidenceSnapshotId: "seethingswarm-test-snapshot",
    assets,
    totalBytes: assets.reduce(
      (totalBytes, asset) => totalBytes + asset.byteLength,
      0,
    ),
  }) satisfies SeethingSwarmStagingResult
}

describe("SeethingSwarm web asset module generator", () => {
  it("generates exact literal imports and immutable typed sources", () => {
    expect(generateSeethingSwarmWebAssetModule(createStagingResult())).toBe(
      [
        'import type { SeethingSwarmStaticAssetSource } from "#game/data/src/SeethingSwarmStaticAssetAdapter"',
        'import seethingSwarmWebAsset0000 from "./batpack_spritesheets/bat_idle_strip4.png"',
        'import seethingSwarmWebAsset0001 from "./frogpack_spritesheets/fly_fly_strip2.png"',
        "",
        "export const SEETHING_SWARM_WEB_STATIC_ASSET_SOURCES = Object.freeze([",
        "  Object.freeze({",
        '    relativePath: "batpack_spritesheets/bat_idle_strip4.png",',
        "    asset: seethingSwarmWebAsset0000,",
        "  }),",
        "  Object.freeze({",
        '    relativePath: "frogpack_spritesheets/fly_fly_strip2.png",',
        "    asset: seethingSwarmWebAsset0001,",
        "  }),",
        "]) satisfies readonly SeethingSwarmStaticAssetSource<unknown>[]",
        "",
      ].join("\n"),
    )
  })

  it("maps all 775 staged sources exactly once without dynamic discovery", () => {
    const paths = Object.freeze(
      Array.from(
        { length: 775 },
        (_, index) => `pack_${index.toString().padStart(4, "0")}/animation.png`,
      ),
    )
    const generatedModule = generateSeethingSwarmWebAssetModule(
      createStagingResult(paths),
    )

    expect(
      generatedModule.match(
        /^import seethingSwarmWebAsset\d{4} from "\.\/.+\.png"$/gm,
      ),
    ).toHaveLength(775)
    expect(
      generatedModule.match(/^    asset: seethingSwarmWebAsset\d{4},$/gm),
    ).toHaveLength(775)
    expect(generatedModule).toContain("seethingSwarmWebAsset0000")
    expect(generatedModule).toContain("seethingSwarmWebAsset0774")
    expect(generatedModule).not.toMatch(/import\s*\(|node:fs|readdir|glob/)
    for (const path of paths) {
      expect(generatedModule.match(new RegExp(path, "g"))).toHaveLength(2)
    }
  })

  it("reproduces byte-identical source from equivalent staging results", () => {
    const firstResult = createStagingResult()
    const equivalentResult = Object.freeze({
      ...firstResult,
      assets: Object.freeze(
        firstResult.assets.map((asset) => Object.freeze({ ...asset })),
      ),
    })

    expect(generateSeethingSwarmWebAssetModule(firstResult)).toBe(
      generateSeethingSwarmWebAssetModule(equivalentResult),
    )
  })

  it("rejects missing snapshot identity and empty source collections", () => {
    expect(() =>
      generateSeethingSwarmWebAssetModule({
        ...createStagingResult(),
        evidenceSnapshotId: " ",
      }),
    ).toThrow("Missing SeethingSwarm web evidence snapshot ID")
    expect(() =>
      generateSeethingSwarmWebAssetModule({
        ...createStagingResult(),
        assets: Object.freeze([]),
        totalBytes: 0,
      }),
    ).toThrow("Missing SeethingSwarm web assets")
  })

  it.each([
    "",
    "pack\\animation.png",
    "/pack/animation.png",
    "pack/animation.gif",
    "pack/../animation.png",
    "pack/./animation.png",
  ])("rejects an unsafe or non-PNG source path: %s", (relativePath) => {
    expect(() =>
      generateSeethingSwarmWebAssetModule(createStagingResult([relativePath])),
    ).toThrow("Invalid SeethingSwarm web asset path")
  })

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid source byte length: %s",
    (byteLength) => {
      expect(() =>
        generateSeethingSwarmWebAssetModule({
          ...createStagingResult(["pack/animation.png"]),
          assets: Object.freeze([
            Object.freeze({
              relativePath: "pack/animation.png",
              byteLength,
            }),
          ]),
          totalBytes: byteLength,
        }),
      ).toThrow("Invalid SeethingSwarm web asset byte length")
    },
  )

  it("rejects duplicate unsorted and arithmetically inconsistent sources", () => {
    expect(() =>
      generateSeethingSwarmWebAssetModule(
        createStagingResult(["pack/a.png", "PACK/a.png"]),
      ),
    ).toThrow("Duplicate SeethingSwarm web asset path")
    expect(() =>
      generateSeethingSwarmWebAssetModule(
        createStagingResult(["pack/b.png", "pack/a.png"]),
      ),
    ).toThrow("Unsorted SeethingSwarm web asset path")
    expect(() =>
      generateSeethingSwarmWebAssetModule({
        ...createStagingResult(),
        totalBytes: 999,
      }),
    ).toThrow(
      "Invalid SeethingSwarm web asset byte total: expected 3, received 999",
    )
  })
})

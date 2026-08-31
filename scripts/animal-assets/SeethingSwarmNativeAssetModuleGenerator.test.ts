import ts from "typescript"
import { describe, expect, it } from "vitest"
import type { SeethingSwarmStagingResult } from "./SeethingSwarmAssetStager"
import { generateSeethingSwarmNativeAssetModule } from "./SeethingSwarmNativeAssetModuleGenerator"

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

describe("SeethingSwarm native asset module generator", () => {
  it("generates exact literal Metro requires and immutable typed sources", () => {
    expect(generateSeethingSwarmNativeAssetModule(createStagingResult())).toBe(
      [
        'import type { SeethingSwarmStaticAssetSource } from "#game/data/src/SeethingSwarmStaticAssetAdapter"',
        "",
        "export const SEETHING_SWARM_NATIVE_STATIC_ASSET_SOURCES = Object.freeze([",
        "  Object.freeze({",
        '    relativePath: "batpack_spritesheets/bat_idle_strip4.png",',
        '    asset: require("./batpack_spritesheets/bat_idle_strip4.png") as number,',
        "  }),",
        "  Object.freeze({",
        '    relativePath: "frogpack_spritesheets/fly_fly_strip2.png",',
        '    asset: require("./frogpack_spritesheets/fly_fly_strip2.png") as number,',
        "  }),",
        "]) satisfies readonly SeethingSwarmStaticAssetSource<number>[]",
        "",
      ].join("\n"),
    )
  })

  it("maps all 775 staged sources through literal statically analyzable requires", () => {
    const paths = Object.freeze(
      Array.from(
        { length: 775 },
        (_, index) => `pack_${index.toString().padStart(4, "0")}/animation.png`,
      ),
    )
    const generatedModule = generateSeethingSwarmNativeAssetModule(
      createStagingResult(paths),
    )
    const requires = generatedModule.match(
      /^    asset: require\("\.\/.+\.png"\) as number,$/gm,
    )

    expect(requires).toHaveLength(775)
    expect(
      generatedModule.match(/^    relativePath: ".+\.png",$/gm),
    ).toHaveLength(775)
    expect(generatedModule).not.toMatch(
      /require\([^"']|require\(`|\$\{|node:fs|readdir|glob/,
    )
    for (const path of paths) {
      expect(generatedModule.match(new RegExp(path, "g"))).toHaveLength(2)
    }
  })

  it("emits syntactically valid TypeScript without transformation diagnostics", () => {
    const generatedModule = generateSeethingSwarmNativeAssetModule(
      createStagingResult(),
    )
    const transpiled = ts.transpileModule(generatedModule, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
      },
      fileName: "SeethingSwarmNativeStaticAssets.ts",
      reportDiagnostics: true,
    })

    expect(transpiled.diagnostics).toEqual([])
  })

  it("reproduces byte-identical source from equivalent staging results", () => {
    const firstResult = createStagingResult()
    const equivalentResult = Object.freeze({
      ...firstResult,
      assets: Object.freeze(
        firstResult.assets.map((asset) => Object.freeze({ ...asset })),
      ),
    })

    expect(generateSeethingSwarmNativeAssetModule(firstResult)).toBe(
      generateSeethingSwarmNativeAssetModule(equivalentResult),
    )
  })

  it("applies the shared validation contract with native-specific failures", () => {
    expect(() =>
      generateSeethingSwarmNativeAssetModule({
        ...createStagingResult(),
        evidenceSnapshotId: " ",
      }),
    ).toThrow("Missing SeethingSwarm native evidence snapshot ID")
    expect(() =>
      generateSeethingSwarmNativeAssetModule(
        createStagingResult(["pack/../animation.png"]),
      ),
    ).toThrow("Invalid SeethingSwarm native asset path")
    expect(() =>
      generateSeethingSwarmNativeAssetModule(
        createStagingResult(["pack/b.png", "pack/a.png"]),
      ),
    ).toThrow("Unsorted SeethingSwarm native asset path")
  })
})

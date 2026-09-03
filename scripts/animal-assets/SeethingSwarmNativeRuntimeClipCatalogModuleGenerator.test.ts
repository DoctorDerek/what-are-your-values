import { createSeethingSwarmTypographyOnlyRuntimeClipCatalog } from "#game/data/src/SeethingSwarmRuntimeClipCatalog"
import { createCompleteSeethingSwarmRuntimeClipTestFixture } from "#game/data/src/SeethingSwarmRuntimeClipCatalog.test-fixture"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import { generateSeethingSwarmNativeRuntimeClipCatalogModule } from "./SeethingSwarmNativeRuntimeClipCatalogModuleGenerator"
import { listSeethingSwarmRuntimeClips } from "./SeethingSwarmRuntimeClipCatalogModuleGenerator"

describe("SeethingSwarm native runtime clip catalog module generator", () => {
  it("statically binds all licensed clips through Metro-analyzable requires", () => {
    const { catalog } = createCompleteSeethingSwarmRuntimeClipTestFixture()
    const clips = listSeethingSwarmRuntimeClips(catalog)
    const generatedModule =
      generateSeethingSwarmNativeRuntimeClipCatalogModule(catalog)

    expect(clips).toHaveLength(775)
    expect(
      generatedModule.match(
        /^        asset: require\("\.\/assets\/.+\.png"\) as number,$/gm,
      ),
    ).toHaveLength(775)
    expect(
      generatedModule.match(/^        kind: "character",$/gm),
    ).toHaveLength(774)
    expect(
      generatedModule.match(/^        kind: "auxiliary-effect",$/gm),
    ).toHaveLength(1)
    expect(generatedModule).toContain("characterClipCount: 774")
    expect(generatedModule).toContain("auxiliaryEffectClipCount: 1")
    expect(generatedModule).toContain(
      "satisfies SeethingSwarmLicensedRuntimeClipCatalog<number>",
    )
    expect(generatedModule).not.toMatch(
      /require\([^"']|require\(`|\$\{|node:fs|readdir|glob/,
    )

    for (const { relativePath } of clips) {
      expect(
        generatedModule.match(
          new RegExp(relativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        ),
      ).toHaveLength(2)
    }
  })

  it("emits syntactically valid and byte-deterministic TypeScript", () => {
    const { catalog } = createCompleteSeethingSwarmRuntimeClipTestFixture()
    const firstModule =
      generateSeethingSwarmNativeRuntimeClipCatalogModule(catalog)
    const secondModule =
      generateSeethingSwarmNativeRuntimeClipCatalogModule(catalog)
    const transpiled = ts.transpileModule(firstModule, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
      },
      fileName: "SeethingSwarmNativeRuntimeClipCatalog.ts",
      reportDiagnostics: true,
    })

    expect(firstModule).toBe(secondModule)
    expect(transpiled.diagnostics).toEqual([])
  })

  it("generates the parallel zero-image public fallback", () => {
    const generatedModule = generateSeethingSwarmNativeRuntimeClipCatalogModule(
      createSeethingSwarmTypographyOnlyRuntimeClipCatalog(),
    )

    expect(generatedModule).toBe(
      [
        'import { createSeethingSwarmTypographyOnlyRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"',
        "",
        "export const SEETHING_SWARM_NATIVE_RUNTIME_CLIP_CATALOG =",
        "  createSeethingSwarmTypographyOnlyRuntimeClipCatalog()",
        "",
      ].join("\n"),
    )
    expect(generatedModule).not.toMatch(/\.png|assets|licensed|snapshot/i)
  })
})

import { createSeethingSwarmTypographyOnlyRuntimeClipCatalog } from "#game/data/src/SeethingSwarmRuntimeClipCatalog"
import { createCompleteSeethingSwarmRuntimeClipTestFixture } from "#game/data/src/SeethingSwarmRuntimeClipCatalog.test-fixture"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import { listSeethingSwarmRuntimeClips } from "./SeethingSwarmRuntimeClipCatalogModuleGenerator"
import { generateSeethingSwarmWebRuntimeClipCatalogModule } from "./SeethingSwarmWebRuntimeClipCatalogModuleGenerator"

describe("SeethingSwarm web runtime clip catalog module generator", () => {
  it("statically binds the complete immutable licensed clip catalog", () => {
    const { catalog } = createCompleteSeethingSwarmRuntimeClipTestFixture()
    const clips = listSeethingSwarmRuntimeClips(catalog)
    const generatedModule =
      generateSeethingSwarmWebRuntimeClipCatalogModule(catalog)

    expect(clips).toHaveLength(775)
    expect(
      generatedModule.match(
        /^import seethingSwarmWebClip\d{4} from "\.\/assets\/.+\.png"$/gm,
      ),
    ).toHaveLength(775)
    expect(
      generatedModule.match(/^        kind: "character",$/gm),
    ).toHaveLength(774)
    expect(
      generatedModule.match(/^        kind: "auxiliary-effect",$/gm),
    ).toHaveLength(1)
    expect(
      generatedModule.match(/^        asset: seethingSwarmWebClip\d{4},$/gm),
    ).toHaveLength(775)
    expect(generatedModule).toContain("seethingSwarmWebClip0000")
    expect(generatedModule).toContain("seethingSwarmWebClip0774")
    expect(generatedModule).toContain("characterClipCount: 774")
    expect(generatedModule).toContain("auxiliaryEffectClipCount: 1")
    expect(generatedModule).toContain(
      "satisfies SeethingSwarmLicensedRuntimeClipCatalog<StaticImageData>",
    )
    expect(generatedModule).not.toMatch(/import\s*\(|node:fs|readdir|glob/)

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
      generateSeethingSwarmWebRuntimeClipCatalogModule(catalog)
    const secondModule =
      generateSeethingSwarmWebRuntimeClipCatalogModule(catalog)
    const transpiled = ts.transpileModule(firstModule, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
      },
      fileName: "SeethingSwarmWebRuntimeClipCatalog.ts",
      reportDiagnostics: true,
    })

    expect(firstModule).toBe(secondModule)
    expect(transpiled.diagnostics).toEqual([])
  })

  it("generates a zero-image public fallback without private metadata", () => {
    const generatedModule = generateSeethingSwarmWebRuntimeClipCatalogModule(
      createSeethingSwarmTypographyOnlyRuntimeClipCatalog(),
    )

    expect(generatedModule).toBe(
      [
        'import { createSeethingSwarmTypographyOnlyRuntimeClipCatalog } from "@game/data/src/SeethingSwarmRuntimeClipCatalog"',
        "",
        "export const SEETHING_SWARM_WEB_RUNTIME_CLIP_CATALOG =",
        "  createSeethingSwarmTypographyOnlyRuntimeClipCatalog()",
        "",
      ].join("\n"),
    )
    expect(generatedModule).not.toMatch(/\.png|assets|licensed|snapshot/i)
  })
})

import {
  createSeethingSwarmAnimalPresentationGeometry,
  createSeethingSwarmTypographyOnlyAnimalPresentationAdapter,
  type SeethingSwarmAnimalPresentation,
  type SeethingSwarmLicensedAnimalPresentationAdapter,
} from "#game/data/src/SeethingSwarmAnimalPresentation"
import { ZOO_ANIMALS } from "#game/data/src/ZooAnimals"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import { generateSeethingSwarmNativePresentationModule } from "./SeethingSwarmNativePresentationModuleGenerator"

const geometry = createSeethingSwarmAnimalPresentationGeometry(32, 32, {
  left: 4,
  top: 8,
  width: 20,
  height: 20,
})

function createPresentation(index: number) {
  const relativePath = `pack_${index.toString().padStart(2, "0")}/idle_strip4.png`
  return Object.freeze({
    animalId: ZOO_ANIMALS[index]!.id,
    animationId: index === 0 ? "idle_upright" : "idle",
    relativePath,
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 4,
    ...geometry,
    asset: relativePath,
  }) satisfies SeethingSwarmAnimalPresentation<string>
}

function createLicensedAdapter() {
  return Object.freeze({
    mode: "licensed",
    evidenceSnapshotId: "seethingswarm-test-snapshot",
    animals: Object.freeze(
      ZOO_ANIMALS.map((_, index) => createPresentation(index)),
    ),
  }) satisfies SeethingSwarmLicensedAnimalPresentationAdapter<string>
}

describe("SeethingSwarm native presentation module generator", () => {
  it("emits exactly 45 literal Metro requires with complete frozen metadata", () => {
    const adapter = createLicensedAdapter()
    const source = generateSeethingSwarmNativePresentationModule(adapter)

    expect(
      source.match(
        /^      asset: require\("\.\/assets\/.+\.png"\) as number,$/gm,
      ),
    ).toHaveLength(45)
    expect(source.match(/^      animalId: /gm)).toHaveLength(45)
    expect(source.match(/^      visibleBounds: Object\.freeze/gm)).toHaveLength(
      45,
    )
    expect(source).toContain(
      ") satisfies SeethingSwarmLicensedAnimalPresentationAdapter<number>",
    )
    expect(source).not.toMatch(
      /require\([^"']|require\(`|\$\{|import\s*\(|node:fs|readdir|glob/,
    )
    expect(source).not.toContain("Q:\\")
    expect(source).not.toContain("private-source")
    for (const presentation of adapter.animals) {
      expect(
        source.match(new RegExp(presentation.relativePath, "g")),
      ).toHaveLength(2)
    }
  })

  it("emits syntactically valid TypeScript without transformation diagnostics", () => {
    const source = generateSeethingSwarmNativePresentationModule(
      createLicensedAdapter(),
    )
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
      },
      fileName: "SeethingSwarmNativeAnimalPresentations.ts",
      reportDiagnostics: true,
    })

    expect(transpiled.diagnostics).toEqual([])
  })

  it("reproduces byte-identical source from equivalent adapter data", () => {
    const adapter = createLicensedAdapter()
    const equivalentAdapter = Object.freeze({
      ...adapter,
      animals: Object.freeze(
        adapter.animals.map((presentation) =>
          Object.freeze({
            ...presentation,
            visibleBounds: Object.freeze({ ...presentation.visibleBounds }),
          }),
        ),
      ),
    })

    expect(generateSeethingSwarmNativePresentationModule(adapter)).toBe(
      generateSeethingSwarmNativePresentationModule(equivalentAdapter),
    )
  })

  it("emits the parallel zero-image typography-only fallback", () => {
    const source = generateSeethingSwarmNativePresentationModule(
      createSeethingSwarmTypographyOnlyAnimalPresentationAdapter(),
    )

    expect(source).toBe(
      [
        'import { createSeethingSwarmTypographyOnlyAnimalPresentationAdapter } from "@game/data/src/SeethingSwarmAnimalPresentation"',
        "",
        "export const SEETHING_SWARM_NATIVE_ANIMAL_PRESENTATIONS =",
        "  createSeethingSwarmTypographyOnlyAnimalPresentationAdapter()",
        "",
      ].join("\n"),
    )
    expect(source).not.toMatch(/\.png|require\(|licensed|evidenceSnapshotId/)
  })

  it("applies the shared custody contract with native-specific failures", () => {
    const adapter = createLicensedAdapter()
    expect(() =>
      generateSeethingSwarmNativePresentationModule({
        ...adapter,
        evidenceSnapshotId: " ",
      }),
    ).toThrow("Missing SeethingSwarm native evidence snapshot ID")
    expect(() =>
      generateSeethingSwarmNativePresentationModule({
        ...adapter,
        animals: adapter.animals.slice(0, -1),
      }),
    ).toThrow("Invalid SeethingSwarm native presentation count: 44")

    const unsafePresentation = Object.freeze({
      ...adapter.animals[0]!,
      relativePath: "pack/../idle.png",
      asset: "pack/../idle.png",
    }) satisfies SeethingSwarmAnimalPresentation<string>
    expect(() =>
      generateSeethingSwarmNativePresentationModule({
        ...adapter,
        animals: [unsafePresentation, ...adapter.animals.slice(1)],
      }),
    ).toThrow("Invalid SeethingSwarm native asset path")
  })
})

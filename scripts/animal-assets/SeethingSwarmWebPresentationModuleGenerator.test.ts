import {
  createSeethingSwarmAnimalPresentationGeometry,
  createSeethingSwarmTypographyOnlyAnimalPresentationAdapter,
  type SeethingSwarmAnimalPresentation,
  type SeethingSwarmAnimalPresentationAdapter,
  type SeethingSwarmLicensedAnimalPresentationAdapter,
} from "#game/data/src/SeethingSwarmAnimalPresentation"
import { ZOO_ANIMALS } from "#game/data/src/ZooAnimals"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import { generateSeethingSwarmWebPresentationModule } from "./SeethingSwarmWebPresentationModuleGenerator"

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

function replacePresentation(
  adapter: SeethingSwarmLicensedAnimalPresentationAdapter<string>,
  index: number,
  replacement: SeethingSwarmAnimalPresentation<string>,
) {
  return Object.freeze({
    ...adapter,
    animals: Object.freeze(
      adapter.animals.map((presentation, presentationIndex) =>
        presentationIndex === index ? replacement : presentation,
      ),
    ),
  })
}

describe("SeethingSwarm web presentation module generator", () => {
  it("emits exactly 45 literal static imports and complete frozen metadata", () => {
    const adapter = createLicensedAdapter()
    const source = generateSeethingSwarmWebPresentationModule(adapter)

    expect(
      source.match(
        /^import seethingSwarmWebAnimal\d{2} from "\.\/assets\/.+\.png"$/gm,
      ),
    ).toHaveLength(45)
    expect(source).toContain("seethingSwarmWebAnimal00")
    expect(source).toContain("seethingSwarmWebAnimal44")
    expect(source).toContain(
      ") satisfies SeethingSwarmLicensedAnimalPresentationAdapter<unknown>",
    )
    expect(source.match(/^      animalId: /gm)).toHaveLength(45)
    expect(source.match(/^      visibleBounds: Object\.freeze/gm)).toHaveLength(
      45,
    )
    expect(source.match(/^      asset: seethingSwarmWebAnimal/gm)).toHaveLength(
      45,
    )
    expect(source).not.toMatch(/import\s*\(|node:fs|readdir|glob|require\(/)
    expect(source).not.toContain("Q:\\")
    expect(source).not.toContain("private-source")
    for (const presentation of adapter.animals) {
      expect(
        source.match(new RegExp(presentation.relativePath, "g")),
      ).toHaveLength(2)
    }
  })

  it("emits syntactically valid TypeScript without transformation diagnostics", () => {
    const source = generateSeethingSwarmWebPresentationModule(
      createLicensedAdapter(),
    )
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext,
      },
      fileName: "SeethingSwarmWebAnimalPresentations.ts",
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

    expect(generateSeethingSwarmWebPresentationModule(adapter)).toBe(
      generateSeethingSwarmWebPresentationModule(equivalentAdapter),
    )
  })

  it("emits a stable zero-image typography-only fallback module", () => {
    const adapter = createSeethingSwarmTypographyOnlyAnimalPresentationAdapter()
    const source = generateSeethingSwarmWebPresentationModule(adapter)

    expect(source).toBe(
      [
        'import { createSeethingSwarmTypographyOnlyAnimalPresentationAdapter } from "@game/data/src/SeethingSwarmAnimalPresentation"',
        "",
        "export const SEETHING_SWARM_WEB_ANIMAL_PRESENTATIONS =",
        "  createSeethingSwarmTypographyOnlyAnimalPresentationAdapter()",
        "",
      ].join("\n"),
    )
    expect(source).not.toMatch(/\.png|licensed|evidenceSnapshotId|animalId/)
  })

  it("rejects invented typography-only metadata and incomplete licensed input", () => {
    expect(() =>
      generateSeethingSwarmWebPresentationModule({
        mode: "typography-only",
        privatePath: "Q:/private",
      } as unknown as SeethingSwarmAnimalPresentationAdapter<string>),
    ).toThrow("Invalid SeethingSwarm web typography-only metadata")

    const adapter = createLicensedAdapter()
    expect(() =>
      generateSeethingSwarmWebPresentationModule({
        ...adapter,
        evidenceSnapshotId: " ",
      }),
    ).toThrow("Missing SeethingSwarm web evidence snapshot ID")
    expect(() =>
      generateSeethingSwarmWebPresentationModule({
        ...adapter,
        animals: adapter.animals.slice(0, -1),
      }),
    ).toThrow("Invalid SeethingSwarm web presentation count: 44")
  })

  it("rejects reordered animals and mismatched prepared paths", () => {
    const adapter = createLicensedAdapter()
    expect(() =>
      generateSeethingSwarmWebPresentationModule({
        ...adapter,
        animals: [
          adapter.animals[1]!,
          adapter.animals[0]!,
          ...adapter.animals.slice(2),
        ],
      }),
    ).toThrow("Invalid SeethingSwarm web presentation at position 0")
    const missingFirstPresentation = Array.from(adapter.animals)
    delete missingFirstPresentation[0]
    expect(() =>
      generateSeethingSwarmWebPresentationModule({
        ...adapter,
        animals: missingFirstPresentation,
      }),
    ).toThrow(
      "Invalid SeethingSwarm web presentation at position 0: expected bat, received missing",
    )
    expect(() =>
      generateSeethingSwarmWebPresentationModule(
        replacePresentation(
          adapter,
          0,
          Object.freeze({ ...adapter.animals[0]!, asset: "changed.png" }),
        ),
      ),
    ).toThrow("Mismatched SeethingSwarm web prepared asset: bat")
  })

  it.each([
    "",
    "pack\\idle.png",
    "/pack/idle.png",
    "pack/idle.gif",
    "pack/../idle.png",
    "pack/./idle.png",
    "pack//idle.png",
    "pack/",
  ])("rejects an unsafe prepared web path: %s", (relativePath) => {
    const adapter = createLicensedAdapter()
    expect(() =>
      generateSeethingSwarmWebPresentationModule(
        replacePresentation(
          adapter,
          0,
          Object.freeze({
            ...adapter.animals[0]!,
            relativePath,
            asset: relativePath,
          }),
        ),
      ),
    ).toThrow("Invalid SeethingSwarm web asset path")
  })

  it("rejects a case-insensitive duplicate prepared path", () => {
    const adapter = createLicensedAdapter()
    const duplicatePath =
      adapter.animals[0]!.relativePath.toUpperCase().replace(/\.PNG$/u, ".png")
    expect(() =>
      generateSeethingSwarmWebPresentationModule(
        replacePresentation(
          adapter,
          1,
          Object.freeze({
            ...adapter.animals[1]!,
            relativePath: duplicatePath,
            asset: duplicatePath,
          }),
        ),
      ),
    ).toThrow("Duplicate SeethingSwarm web prepared asset")
  })
})

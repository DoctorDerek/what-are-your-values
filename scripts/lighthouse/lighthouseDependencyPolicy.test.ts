import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

type PackageManifest = {
  dependencies?: { [packageName: string]: string }
  devDependencies?: { [packageName: string]: string }
  scripts?: { [scriptName: string]: string }
}

const packageManifest = JSON.parse(
  fs.readFileSync(path.resolve("package.json"), "utf8"),
) as PackageManifest
const webPackageManifest = JSON.parse(
  fs.readFileSync(path.resolve("apps/web/package.json"), "utf8"),
) as PackageManifest
const workspaceConfiguration = fs.readFileSync(
  path.resolve("pnpm-workspace.yaml"),
  "utf8",
)

describe("Lighthouse dependency policy", () => {
  it("uses the supported direct Lighthouse runner dependencies", () => {
    expect(packageManifest.scripts?.lighthouse).toContain(
      "collectLighthouseReports.cli.ts",
    )
    expect(packageManifest.devDependencies?.lighthouse).toMatch(/^\^\d+$/)
    expect(packageManifest.devDependencies?.["chrome-launcher"]).toMatch(
      /^\^\d+$/,
    )
    expect(packageManifest.devDependencies).not.toHaveProperty("@lhci/cli")
  })

  it("keeps the shared React runtime aligned with Expo", () => {
    expect(packageManifest.devDependencies?.react).toBe("19.2.3")
    expect(packageManifest.devDependencies?.["react-dom"]).toBe("19.2.3")
    expect(webPackageManifest.dependencies?.react).toBe("19.2.3")
    expect(webPackageManifest.dependencies?.["react-dom"]).toBe("19.2.3")
  })

  it("keeps the verified transitive security resolutions", () => {
    expect(workspaceConfiguration).toContain(
      '"brace-expansion@<1.1.18": "1.1.18"',
    )
    expect(workspaceConfiguration).toContain(
      '"brace-expansion@>=5.0.0 <5.0.9": "5.0.9"',
    )
    expect(workspaceConfiguration).toContain('"nanoid@<3.3.18": "3.3.18"')
    expect(workspaceConfiguration).toContain('"postcss@<8.5.23": "8.5.26"')
    expect(workspaceConfiguration).toContain('"xcode>uuid": "11.1.1"')
  })

  it("does not hide or force the unavailable image-size fix", () => {
    expect(workspaceConfiguration).not.toContain("GHSA-5p2g-fcmc-qvqq")
    expect(workspaceConfiguration).not.toContain("GHSA-w3rx-r6r6-pgpr")
    expect(workspaceConfiguration).not.toContain("metro>image-size")
  })
})

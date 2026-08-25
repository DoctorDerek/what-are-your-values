import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { copyServiceWorkerToStaticExport } from "@/scripts/copyServiceWorkerToStaticExport"

const temporaryDirectories: string[] = []

const createTemporaryWebDirectory = () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "wayvm-service-worker-"),
  )
  temporaryDirectories.push(temporaryDirectory)
  fs.mkdirSync(path.join(temporaryDirectory, "public"))
  fs.mkdirSync(path.join(temporaryDirectory, "out"))
  return temporaryDirectory
}

afterEach(() => {
  for (const temporaryDirectory of temporaryDirectories.splice(0))
    fs.rmSync(temporaryDirectory, { force: true, recursive: true })
})

describe("copyServiceWorkerToStaticExport", () => {
  it("copies the generated public worker into the static export", () => {
    const webDirectory = createTemporaryWebDirectory()
    const serviceWorker = "self.addEventListener('install', () => {})"
    fs.writeFileSync(path.join(webDirectory, "public", "sw.js"), serviceWorker)

    copyServiceWorkerToStaticExport(webDirectory)

    expect(
      fs.readFileSync(path.join(webDirectory, "out", "sw.js"), "utf8"),
    ).toBe(serviceWorker)
  })

  it("fails loudly when Serwist did not generate the public worker", () => {
    const webDirectory = createTemporaryWebDirectory()

    expect(() => copyServiceWorkerToStaticExport(webDirectory)).toThrowError(
      /ENOENT/,
    )
  })

  it("wires the canonical public worker into the web build", () => {
    const serwistConfiguration = fs.readFileSync(
      path.resolve("apps/web/serwist.config.mjs"),
      "utf8",
    )
    const webPackage = JSON.parse(
      fs.readFileSync(path.resolve("apps/web/package.json"), "utf8"),
    ) as { scripts: { build: string } }

    expect(serwistConfiguration).toContain('swDest: "public/sw.js"')
    expect(webPackage.scripts.build).toContain(
      "scripts/copyServiceWorkerToStaticExport.cli.ts",
    )
  })
})

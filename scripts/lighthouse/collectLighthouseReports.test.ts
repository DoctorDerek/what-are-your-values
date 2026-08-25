import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { collectLighthouseReports } from "./collectLighthouseReports"

const { launchChromeAdapter, runLighthouseAdapter } = vi.hoisted(() => ({
  launchChromeAdapter: vi.fn(),
  runLighthouseAdapter: vi.fn(),
}))

vi.mock("chrome-launcher", () => ({ launch: launchChromeAdapter }))
vi.mock("lighthouse", () => ({ default: runLighthouseAdapter }))

const temporaryDirectories: string[] = []

const createTemporaryDirectory = () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "wayvm-lighthouse-collector-"),
  )
  temporaryDirectories.push(temporaryDirectory)
  return temporaryDirectory
}

describe("collectLighthouseReports", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    launchChromeAdapter.mockReset()
    runLighthouseAdapter.mockReset()

    for (const temporaryDirectory of temporaryDirectories.splice(0))
      fs.rmSync(temporaryDirectory, { force: true, recursive: true })
  })

  it("uses the direct Lighthouse and Chrome adapters", async () => {
    const outputDirectory = createTemporaryDirectory()
    const killChrome = vi.fn(async () => undefined)

    launchChromeAdapter.mockResolvedValue({ kill: killChrome, port: 9222 })
    runLighthouseAdapter.mockResolvedValue({
      lhr: { categories: {} },
      report: "adapter-report",
    })

    const manifest = await collectLighthouseReports({
      numberOfRuns: 1,
      outputDirectory,
      targetUrl: "https://www.whatareyourvaluesmapache.com/",
    })

    expect(launchChromeAdapter).toHaveBeenCalledWith({
      chromeFlags: ["--headless=new", "--no-sandbox"],
      userDataDir: expect.stringContaining("wayvm-lighthouse-"),
    })
    expect(runLighthouseAdapter).toHaveBeenCalledWith(
      "https://www.whatareyourvaluesmapache.com/",
      expect.objectContaining({ port: 9222 }),
    )
    expect(killChrome).toHaveBeenCalledOnce()
    expect(fs.readFileSync(manifest[0]?.htmlPath ?? "", "utf8")).toBe(
      "adapter-report",
    )
  })

  it("rejects an empty direct Lighthouse result", async () => {
    const killChrome = vi.fn(async () => undefined)

    launchChromeAdapter.mockResolvedValue({ kill: killChrome, port: 9222 })
    runLighthouseAdapter.mockResolvedValue(undefined)

    await expect(
      collectLighthouseReports({
        numberOfRuns: 1,
        outputDirectory: createTemporaryDirectory(),
        targetUrl: "https://www.whatareyourvaluesmapache.com/",
      }),
    ).rejects.toThrow("run 1 did not return a result")
    expect(killChrome).toHaveBeenCalledOnce()
  })

  it("rejects a malformed direct Lighthouse HTML report", async () => {
    const killChrome = vi.fn(async () => undefined)

    launchChromeAdapter.mockResolvedValue({ kill: killChrome, port: 9222 })
    runLighthouseAdapter.mockResolvedValue({ lhr: {}, report: ["invalid"] })

    await expect(
      collectLighthouseReports({
        numberOfRuns: 1,
        outputDirectory: createTemporaryDirectory(),
        targetUrl: "https://www.whatareyourvaluesmapache.com/",
      }),
    ).rejects.toThrow("invalid HTML report")
    expect(killChrome).toHaveBeenCalledOnce()
  })
})

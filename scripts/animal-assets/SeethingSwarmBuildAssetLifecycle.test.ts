import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import { join, resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createSeethingSwarmArchive } from "./SeethingSwarmArchiveCreator"
import {
  getSeethingSwarmAssetCustodyPaths,
  SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME,
} from "./SeethingSwarmAssetCustody"
import { runSeethingSwarmAssetDecryption } from "./SeethingSwarmAssetDecryption"
import {
  prepareSeethingSwarmPresentationAssets,
  SEETHING_SWARM_RUNTIME_CLIP_CATALOG_MODULE_FILE_NAME,
} from "./SeethingSwarmPresentationAssetPreparer"
import {
  cleanUpSeethingSwarmPresentationTestWorkspaces,
  createCompleteSeethingSwarmPresentationCustody,
  createSeethingSwarmPresentationTestWorkspace,
  listSeethingSwarmPresentationTestFiles,
  seethingSwarmPresentationModuleGenerators,
} from "./SeethingSwarmPresentationAssetPreparer.test-fixture"

const SYNTHETIC_ASSET_KEY = "synthetic-build-lifecycle-key-with-ample-length"
const BUILD_ASSET_LIFECYCLE_TEST_TIMEOUT_MS = 60_000

function readWebBuildDryRun(assetKey?: string) {
  const summary: unknown = JSON.parse(
    execFileSync(
      process.execPath,
      [
        createRequire(import.meta.url).resolve("turbo/bin/turbo"),
        "run",
        "build",
        "--filter=@game/web",
        "--dry=json",
        "--cache=local:rw",
      ],
      {
        cwd: resolve("apps/web"),
        env: {
          ...process.env,
          [SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME]: assetKey,
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: BUILD_ASSET_LIFECYCLE_TEST_TIMEOUT_MS,
      },
    ),
  )
  assert(
    summary !== null &&
      typeof summary === "object" &&
      "tasks" in summary &&
      Array.isArray(summary.tasks),
  )
  const webBuild: unknown = summary.tasks.find(
    (task: unknown) =>
      task !== null &&
      typeof task === "object" &&
      "taskId" in task &&
      task.taskId === "@game/web#build",
  )
  assert(
    webBuild !== null &&
      typeof webBuild === "object" &&
      "hash" in webBuild &&
      typeof webBuild.hash === "string",
  )
  return webBuild
}

afterEach(async () => {
  await cleanUpSeethingSwarmPresentationTestWorkspaces()
})

describe("SeethingSwarm protected build asset lifecycle", () => {
  it("passes the protected key through strict Turbo builds with distinct cache identities", () => {
    const publicBuild = readWebBuildDryRun()
    const protectedBuild = readWebBuildDryRun(SYNTHETIC_ASSET_KEY)
    const rotatedBuild = readWebBuildDryRun(`${SYNTHETIC_ASSET_KEY}-rotated`)

    expect(
      new Set([publicBuild.hash, protectedBuild.hash, rotatedBuild.hash]).size,
    ).toBe(3)
    expect(protectedBuild).toMatchObject({
      command: "next build",
      envMode: "strict",
      environmentVariables: {
        specified: {
          env: [SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME],
          passThroughEnv: null,
        },
        configured: [
          expect.stringMatching(
            `^${SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME}=`,
          ),
        ],
      },
      resolvedTaskDefinition: {
        cache: true,
        dependsOn: ["^build"],
        outputs: expect.arrayContaining([
          ".next/**",
          "!.next/cache/**",
          "out/**",
        ]),
      },
      inputs: expect.objectContaining(
        Object.fromEntries(
          [
            "package.json",
            "next.config.ts",
            "../../ghost_assets/seethingswarm-assets.zip",
            "../../scripts/decrypt-assets.ts",
            "../../scripts/runTypeScript.mjs",
            "../../scripts/animal-assets/SeethingSwarmAssetDecryption.ts",
            "../../scripts/animal-assets/SeethingSwarmPresentationAssetPreparer.ts",
            "../../scripts/animal-assets/SeethingSwarmWebRuntimeClipCatalogModuleGenerator.ts",
            "../../tsconfig.json",
          ].map((path) => [path, expect.any(String)]),
        ),
      ),
    })
  })

  it(
    "injects licensed presentation assets and restores the public typography fallback",
    async () => {
      const paths = await createSeethingSwarmPresentationTestWorkspace()
      const fixture =
        await createCompleteSeethingSwarmPresentationCustody(paths)
      const custodyPaths = getSeethingSwarmAssetCustodyPaths(
        paths.repositoryRoot,
      )
      await createSeethingSwarmArchive({
        archivePath: custodyPaths.archivePath,
        assetKey: SYNTHETIC_ASSET_KEY,
        custodyDirectory: custodyPaths.custodyDirectory,
      })
      await rm(custodyPaths.vendorDirectory, {
        force: true,
        recursive: true,
      })

      const protectedBuildStatus: string[] = []
      const protectedBuildResult = await runSeethingSwarmAssetDecryption({
        environment: {
          [SEETHING_SWARM_ASSET_KEY_ENVIRONMENT_VARIABLE_NAME]:
            SYNTHETIC_ASSET_KEY,
        },
        repositoryRoot: paths.repositoryRoot,
        writeStatus: (message) => protectedBuildStatus.push(message),
      })
      const licensedPresentationResult =
        await prepareSeethingSwarmPresentationAssets(
          paths,
          seethingSwarmPresentationModuleGenerators,
        )

      expect(protectedBuildResult).toEqual({ mode: "licensed" })
      expect(licensedPresentationResult).toEqual({
        mode: "licensed",
        assetCount: 775,
      })
      expect(protectedBuildStatus).toEqual([
        "Extracted the authorized SeethingSwarm asset archive.\n",
      ])
      expect(protectedBuildStatus.join("")).not.toContain(SYNTHETIC_ASSET_KEY)
      expect(protectedBuildStatus.join("")).not.toContain(paths.repositoryRoot)
      expect(
        (
          await listSeethingSwarmPresentationTestFiles(paths.webOutputRoot)
        ).filter((relativePath) => relativePath.endsWith(".png")),
      ).toEqual(
        fixture.allAssetPaths.map((path) => `assets/${path}`).toSorted(),
      )
      expect(
        (
          await listSeethingSwarmPresentationTestFiles(paths.nativeOutputRoot)
        ).filter((relativePath) => relativePath.endsWith(".png")),
      ).toEqual(
        fixture.allAssetPaths.map((path) => `assets/${path}`).toSorted(),
      )

      await rm(custodyPaths.vendorDirectory, {
        force: true,
        recursive: true,
      })
      const publicBuildResult = await runSeethingSwarmAssetDecryption({
        environment: {},
        repositoryRoot: paths.repositoryRoot,
        writeStatus: () => undefined,
      })
      const typographyPresentationResult =
        await prepareSeethingSwarmPresentationAssets(
          paths,
          seethingSwarmPresentationModuleGenerators,
        )

      expect(publicBuildResult).toEqual({ mode: "unkeyed" })
      expect(typographyPresentationResult).toEqual({
        mode: "typography-only",
        assetCount: 0,
      })
      expect(
        await listSeethingSwarmPresentationTestFiles(paths.webOutputRoot),
      ).toEqual([SEETHING_SWARM_RUNTIME_CLIP_CATALOG_MODULE_FILE_NAME])
      expect(
        await listSeethingSwarmPresentationTestFiles(paths.nativeOutputRoot),
      ).toEqual([SEETHING_SWARM_RUNTIME_CLIP_CATALOG_MODULE_FILE_NAME])
      expect(
        await readFile(
          join(
            paths.webOutputRoot,
            SEETHING_SWARM_RUNTIME_CLIP_CATALOG_MODULE_FILE_NAME,
          ),
          "utf8",
        ),
      ).toContain("createSeethingSwarmTypographyOnlyRuntimeClipCatalog")
    },
    BUILD_ASSET_LIFECYCLE_TEST_TIMEOUT_MS,
  )
})

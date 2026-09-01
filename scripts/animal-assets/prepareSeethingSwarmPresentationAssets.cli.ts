import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { generateSeethingSwarmNativePresentationModule } from "./SeethingSwarmNativePresentationModuleGenerator"
import {
  prepareSeethingSwarmPresentationAssets,
  type SeethingSwarmPresentationPreparationPaths,
} from "./SeethingSwarmPresentationAssetPreparer"
import { sanitizeSeethingSwarmPrivateSourceError } from "./SeethingSwarmPrivatePathSanitizer"
import { generateSeethingSwarmWebPresentationModule } from "./SeethingSwarmWebPresentationModuleGenerator"

export function getSeethingSwarmPresentationPreparationPaths(
  repositoryRoot: string,
) {
  return Object.freeze({
    registryPath: resolve(repositoryRoot, "vendor/seethingswarm/registry.json"),
    stagingRoot: resolve(repositoryRoot, "vendor/seethingswarm/assets"),
    receiptPath: resolve(
      repositoryRoot,
      "vendor/seethingswarm/assets/staging-receipt.json",
    ),
    webOutputRoot: resolve(repositoryRoot, "apps/web/generated/seethingswarm"),
    nativeOutputRoot: resolve(
      repositoryRoot,
      "apps/mobile/generated/seethingswarm",
    ),
  }) satisfies SeethingSwarmPresentationPreparationPaths
}

export async function runSeethingSwarmPresentationPreparationCli(
  repositoryRoot = process.cwd(),
  writeStatus: (message: string) => unknown = (message) =>
    process.stdout.write(message),
) {
  const paths = getSeethingSwarmPresentationPreparationPaths(repositoryRoot)
  try {
    const result = await prepareSeethingSwarmPresentationAssets(paths, {
      web: generateSeethingSwarmWebPresentationModule,
      native: generateSeethingSwarmNativePresentationModule,
    })
    writeStatus(
      result.mode === "licensed"
        ? `Prepared ${result.assetCount} verified SeethingSwarm Hub animals for web and native builds.\n`
        : "Prepared typography-only SeethingSwarm presentation bindings for web and native builds.\n",
    )
    return result
  } catch (error: unknown) {
    throw sanitizeSeethingSwarmPrivateSourceError(
      error,
      paths.stagingRoot,
      "presentation preparation",
    )
  }
}

const directEntryPath = process.argv[2] ? resolve(process.argv[2]) : ""
if (directEntryPath === fileURLToPath(import.meta.url)) {
  await runSeethingSwarmPresentationPreparationCli()
}

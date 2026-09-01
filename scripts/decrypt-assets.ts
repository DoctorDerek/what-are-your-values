import { runSeethingSwarmAssetDecryption } from "./animal-assets/SeethingSwarmAssetDecryption"

try {
  await runSeethingSwarmAssetDecryption()
} catch (error: unknown) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "SeethingSwarm asset extraction failed."}\n`,
  )
  process.exitCode = 1
}

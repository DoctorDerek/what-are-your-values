# Protected SeethingSwarm Asset Operations

This directory is the tracked transport boundary for licensed SeethingSwarm animal assets. The repository may contain the encrypted `seethingswarm-assets.zip` build input, but it must never contain the raw source packs, decrypted `vendor/seethingswarm` custody, purchase records, private download links, or the encryption key.

The canonical build-time secret is `GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE`. It is intentionally not prefixed with `NEXT_PUBLIC_` or `EXPO_PUBLIC_` because it must never enter a browser or native application bundle.

## Preconditions

Before creating or deploying an archive:

1. Confirm that the operator owns or otherwise has authorization to use every included pack for the intended commercial build and deployment.
2. Confirm the applicable current SeethingSwarm terms and the repository notice in `LICENSE.txt`.
3. Keep receipts and purchase evidence in private records outside the repository.
4. Verify that `vendor/seethingswarm` contains the validated registry, staging receipt, generated static asset modules, and licensed PNG files produced by the staging pipeline.
5. Create and retain one unique key of at least 32 characters in a password manager. Never paste it into chat, a commit, an issue, a pull request, a command argument, or a log.

## Create or rotate the encrypted archive

Run the archive creator from the repository root in an interactive PowerShell session. The prompt keeps the key out of shell history, and the cleanup removes it from the process environment after the command finishes.

```powershell
$protectedAssetKey = Read-Host "Protected asset key" -AsSecureString
$protectedAssetKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($protectedAssetKey)
try {
  $env:GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($protectedAssetKeyPointer)
  pnpm animal-assets:create-encrypted-archive
} finally {
  Remove-Item Env:GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($protectedAssetKeyPointer)
}
```

The command writes `ghost_assets/seethingswarm-assets.zip` only after it has:

- rejected unsafe, ambiguous, oversized, missing, or symbolic-link source entries;
- encrypted every file payload with AES-256 AE-2;
- extracted the temporary archive through the production extractor; and
- compared every extracted byte with the ignored source custody.

Only the verified encrypted archive may be committed. `vendor/seethingswarm` remains ignored and must not be force-added.

ZIP entry names remain visible in the archive directory even though their contents are encrypted. The archive therefore uses repository-relative, normalized asset names and contains no receipts, credentials, private download URLs, or absolute source paths.

## Vercel protected web builds

Add `GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE` as a project-level Sensitive environment variable for both Preview and Production. Use the Vercel dashboard’s interactive secret field or the interactive CLI prompts; do not pipe or echo the value through shell history.

```powershell
vercel env add GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE preview --sensitive
vercel env add GHOST_ASSET_KEY_WHAT_ARE_YOUR_VALUES_MAPACHE production --sensitive
```

Environment-variable changes affect only new deployments. Redeploy Preview and Production after adding or rotating the key. The existing web prebuild runs archive extraction before presentation preparation.

## EAS protected native builds

In the Expo project dashboard, create the same project-level variable with Secret visibility. Assign the same value to every EAS environment that will build licensed animals:

- Development for development-client builds;
- Preview for internal preview builds; and
- Production for staging or production store builds.

The current build profiles select those EAS environments according to Expo’s profile defaults. The existing EAS post-install hook extracts the archive before preparing native presentation assets. Do not use an `EXPO_PUBLIC_` variable, and do not place the key in `eas.json`.

## Verification modes

An unkeyed clean clone with no ignored licensed custody is the intentional public-source verification mode. It must finish successfully with typography-only animal presentation and must remove any stale prepared PNG output. On an authorized workstation that already contains verified `vendor/seethingswarm` custody, omitting the key skips archive extraction without deleting that local source, so presentation preparation may still use the licensed animals.

A keyed build is an authorized protected mode. It must fail if the archive is absent, malformed, ambiguously named, unsafe, corrupt, or encrypted with a different key. A successful keyed build extracts into ignored custody, verifies the presentation receipt, and prepares exactly the licensed animal strips selected by the registry.

Use the repository’s standard quality commands after changing the archive or custody tooling:

```powershell
pnpm format
pnpm lint
pnpm test:coverage
pnpm build
```

Inspect build logs only for the safe extraction status. The key and private filesystem paths must never appear.

## Rotation and incident response

Rotate the archive and key as one unit:

1. Generate and store a new unique key.
2. Recreate and verify the archive with the new key.
3. Update the Vercel Preview and Production variables.
4. Update the EAS Development, Preview, and Production variables.
5. Commit the new encrypted archive without rewriting published history.
6. Redeploy the protected web targets and start fresh protected native builds.
7. Verify both protected and unkeyed modes before deleting the old key from private records.

Key rotation does not erase older encrypted archives from Git history. If a key may have been exposed, treat every historical archive encrypted with that key as potentially decryptable, preserve incident evidence privately, and reassess distribution with the rights holder before continuing deployment.

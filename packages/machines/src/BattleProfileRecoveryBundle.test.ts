import { describe, expect, it } from "vitest"
import {
  createBattleProfileRecoveryBundle,
  WAYVM_RECOVERY_BUNDLE_FORMAT,
  WAYVM_RECOVERY_BUNDLE_VERSION,
} from "./BattleProfileRecoveryBundle"
import { createSha256Hex } from "./Sha256"

const EXPORTED_AT = "2026-07-29T12:34:56.000Z"

describe("Battle Profile Recovery Bundle", () => {
  it("exports exact captured bytes in sorted order with failure context and a content hash", async () => {
    const download = await createBattleProfileRecoveryBundle({
      entries: new Map([
        ["wayvm.snapshot.b", "corrupt-b"],
        ["wayvm.snapshot.a", "corrupt-a"],
      ]),
      exportedAt: EXPORTED_AT,
      issue: "Both checkpoint slots are unreadable",
      sourceAppVersion: "0.1.0",
      sourceBuild: "recovery-build",
    })
    const tuple = JSON.parse(download.serialized) as unknown[]

    expect(download.filename).toBe(
      "what-are-your-values-mapache-recovery-2026-07-29-123456Z.json",
    )
    expect(tuple.slice(0, 7)).toEqual([
      WAYVM_RECOVERY_BUNDLE_FORMAT,
      WAYVM_RECOVERY_BUNDLE_VERSION,
      EXPORTED_AT,
      "0.1.0",
      "recovery-build",
      "Both checkpoint slots are unreadable",
      [
        ["wayvm.snapshot.a", "corrupt-a"],
        ["wayvm.snapshot.b", "corrupt-b"],
      ],
    ])
    await expect(
      createSha256Hex(JSON.stringify(tuple.slice(0, 7))),
    ).resolves.toBe(tuple[7])
  })

  it("rejects missing failure context and empty captured storage keys", async () => {
    await expect(
      createBattleProfileRecoveryBundle({
        entries: new Map(),
        exportedAt: EXPORTED_AT,
        issue: "",
        sourceAppVersion: "0.1.0",
        sourceBuild: "recovery-build",
      }),
    ).rejects.toThrow("Recovery issue is required")
    await expect(
      createBattleProfileRecoveryBundle({
        entries: new Map([["", "corrupt"]]),
        exportedAt: EXPORTED_AT,
        issue: "Unreadable",
        sourceAppVersion: "0.1.0",
        sourceBuild: "recovery-build",
      }),
    ).rejects.toThrow("empty storage key")
  })
})

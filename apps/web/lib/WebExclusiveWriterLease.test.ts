import { describe, expect, it, vi } from "vitest"
import {
  acquireWebExclusiveWriterLease,
  WEB_EXCLUSIVE_WRITER_LOCK_NAME,
  type WebExclusiveWriterLockManager,
} from "./WebExclusiveWriterLease"

const exclusiveLock = Object.freeze({
  name: WEB_EXCLUSIVE_WRITER_LOCK_NAME,
  mode: "exclusive" as const,
}) satisfies Lock

describe("Web Exclusive Writer Lease", () => {
  it("fails closed when the Web Locks API is unavailable", async () => {
    await expect(acquireWebExclusiveWriterLease(null)).resolves.toEqual({
      status: "read-only",
      reason: "lock-api-unavailable",
    })
  })

  it("reports contention without waiting or stealing", async () => {
    const request = vi.fn<WebExclusiveWriterLockManager["request"]>(
      async (_name, _options, callback) => callback(null),
    )

    await expect(acquireWebExclusiveWriterLease({ request })).resolves.toEqual({
      status: "read-only",
      reason: "lock-unavailable",
    })
    expect(request).toHaveBeenCalledWith(
      WEB_EXCLUSIVE_WRITER_LOCK_NAME,
      { mode: "exclusive", ifAvailable: true },
      expect.any(Function),
    )
  })

  it("holds the exclusive lock until its idempotent release is requested", async () => {
    let completeCallback: () => void = () => undefined
    const callbackCompleted = new Promise<void>((resolve) => {
      completeCallback = resolve
    })
    const request = vi.fn<WebExclusiveWriterLockManager["request"]>(
      async (_name, _options, callback) => {
        await callback(exclusiveLock)
        completeCallback()
      },
    )

    const result = await acquireWebExclusiveWriterLease({ request })

    expect(result.status).toBe("writer")
    expect(Object.isFrozen(result)).toBe(true)
    if (result.status !== "writer")
      throw new Error("The exclusive writer lease was not acquired")

    result.release()
    result.release()
    await callbackCompleted
    expect(request).toHaveBeenCalledOnce()
  })

  it("normalizes asynchronous lock request failures", async () => {
    const request = vi.fn<WebExclusiveWriterLockManager["request"]>(
      async () => {
        throw new Error("Web Lock request failed")
      },
    )

    await expect(acquireWebExclusiveWriterLease({ request })).resolves.toEqual({
      status: "read-only",
      reason: "lock-request-failed",
      issue: "Web Lock request failed",
    })
  })

  it("normalizes synchronous lock manager failures", async () => {
    const request: WebExclusiveWriterLockManager["request"] = () => {
      throw new Error("Web Lock manager failed")
    }

    await expect(acquireWebExclusiveWriterLease({ request })).resolves.toEqual({
      status: "read-only",
      reason: "lock-request-failed",
      issue: "Web Lock manager failed",
    })
  })
})

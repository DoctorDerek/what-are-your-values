import { renderHook, waitFor } from "@testing-library/react"
import { StrictMode, type ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import useWebExclusiveWriterLease, {
  createWebExclusiveWriterCoordinator,
} from "@/lib/useWebExclusiveWriterLease"
import type {
  WebExclusiveWriterLeaseResult,
  WebExclusiveWriterLockManager,
} from "@/lib/WebExclusiveWriterLease"

function StrictModeWrapper({ children }: { readonly children: ReactNode }) {
  return <StrictMode>{children}</StrictMode>
}

describe("Web Exclusive Writer React Lifecycle", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses browser lock discovery when no acquisition override is supplied", async () => {
    const request = vi.fn<WebExclusiveWriterLockManager["request"]>(
      async (_name, _options, callback) => callback(null),
    )
    vi.stubGlobal("navigator", Object.freeze({ locks: { request } }))
    const coordinator = createWebExclusiveWriterCoordinator()
    const { result } = renderHook(() => useWebExclusiveWriterLease(coordinator))

    await waitFor(() => expect(result.current.status).toBe("read-only"))
    expect(request).toHaveBeenCalledOnce()
  })

  it("shares one acquisition across the Strict Mode rehearsal and releases on final unmount", async () => {
    let settleAcquisition: (
      lease: WebExclusiveWriterLeaseResult,
    ) => void = () => undefined
    const acquisition = new Promise<WebExclusiveWriterLeaseResult>(
      (resolve) => {
        settleAcquisition = resolve
      },
    )
    const release = vi.fn()
    const acquireLease = vi.fn(() => acquisition)
    const coordinator = createWebExclusiveWriterCoordinator(acquireLease)
    const { result, unmount } = renderHook(
      () => useWebExclusiveWriterLease(coordinator),
      { wrapper: StrictModeWrapper },
    )

    expect(result.current).toEqual({ status: "checking" })
    expect(acquireLease).toHaveBeenCalledOnce()

    settleAcquisition(Object.freeze({ status: "writer", release }))
    await waitFor(() => expect(result.current.status).toBe("writer"))

    unmount()
    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce())
  })

  it("releases a writer lease that arrives after its last subscriber leaves", async () => {
    let settleAcquisition: (
      lease: WebExclusiveWriterLeaseResult,
    ) => void = () => undefined
    const acquisition = new Promise<WebExclusiveWriterLeaseResult>(
      (resolve) => {
        settleAcquisition = resolve
      },
    )
    const release = vi.fn()
    const coordinator = createWebExclusiveWriterCoordinator(() => acquisition)
    const { unmount } = renderHook(() =>
      useWebExclusiveWriterLease(coordinator),
    )

    unmount()
    await Promise.resolve()
    settleAcquisition(Object.freeze({ status: "writer", release }))

    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce())
    expect(coordinator.getSnapshot()).toEqual({ status: "checking" })
  })

  it("resets an abandoned read-only acquisition without inventing a release", async () => {
    let settleAcquisition: (
      lease: WebExclusiveWriterLeaseResult,
    ) => void = () => undefined
    const acquisition = new Promise<WebExclusiveWriterLeaseResult>(
      (resolve) => {
        settleAcquisition = resolve
      },
    )
    const coordinator = createWebExclusiveWriterCoordinator(() => acquisition)
    const { unmount } = renderHook(() =>
      useWebExclusiveWriterLease(coordinator),
    )

    unmount()
    await Promise.resolve()
    settleAcquisition(
      Object.freeze({
        status: "read-only",
        reason: "lock-unavailable",
      }),
    )

    await vi.waitFor(() =>
      expect(coordinator.getSnapshot().status).toBe("checking"),
    )
  })

  it("retains ownership for remaining and synchronously returning subscribers", async () => {
    const release = vi.fn()
    const coordinator = createWebExclusiveWriterCoordinator(async () =>
      Object.freeze({ status: "writer", release }),
    )
    const unsubscribeFirst = coordinator.subscribe(vi.fn())
    const unsubscribeSecond = coordinator.subscribe(vi.fn())
    await vi.waitFor(() =>
      expect(coordinator.getSnapshot().status).toBe("writer"),
    )

    unsubscribeFirst()
    await Promise.resolve()
    expect(release).not.toHaveBeenCalled()

    unsubscribeSecond()
    const unsubscribeReturning = coordinator.subscribe(vi.fn())
    await Promise.resolve()
    expect(release).not.toHaveBeenCalled()

    unsubscribeReturning()
    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce())
  })

  it("retries acquisition when a later lifecycle follows a read-only result", async () => {
    const acquireLease = vi.fn(async () =>
      Object.freeze({
        status: "read-only",
        reason: "lock-unavailable",
      } as const),
    )
    const coordinator = createWebExclusiveWriterCoordinator(acquireLease)
    const firstLifecycle = renderHook(() =>
      useWebExclusiveWriterLease(coordinator),
    )

    await waitFor(() =>
      expect(firstLifecycle.result.current.status).toBe("read-only"),
    )
    firstLifecycle.unmount()
    await vi.waitFor(() =>
      expect(coordinator.getSnapshot().status).toBe("checking"),
    )

    const secondLifecycle = renderHook(() =>
      useWebExclusiveWriterLease(coordinator),
    )
    await waitFor(() =>
      expect(secondLifecycle.result.current.status).toBe("read-only"),
    )
    expect(acquireLease).toHaveBeenCalledTimes(2)
  })
})

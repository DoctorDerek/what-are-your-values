"use client"

import { useSyncExternalStore } from "react"
import {
  acquireWebExclusiveWriterLease,
  type WebExclusiveWriterLeaseResult,
} from "@/lib/WebExclusiveWriterLease"

const WEB_EXCLUSIVE_WRITER_CHECKING = Object.freeze({
  status: "checking",
} as const)

export type WebExclusiveWriterLeaseSnapshot =
  typeof WEB_EXCLUSIVE_WRITER_CHECKING | WebExclusiveWriterLeaseResult

export type WebExclusiveWriterCoordinator = Readonly<{
  subscribe: (onStoreChange: () => void) => () => void
  getSnapshot: () => WebExclusiveWriterLeaseSnapshot
}>

export function createWebExclusiveWriterCoordinator(
  acquireLease: () => Promise<WebExclusiveWriterLeaseResult> = () =>
    acquireWebExclusiveWriterLease(),
): WebExclusiveWriterCoordinator {
  let snapshot: WebExclusiveWriterLeaseSnapshot = WEB_EXCLUSIVE_WRITER_CHECKING
  let acquisitionIsPending = false
  let releaseLeaseAfterAcquisition = false
  const subscribers = new Set<() => void>()

  const notifySubscribers = () => {
    subscribers.forEach((subscriber) => subscriber())
  }

  const startAcquisition = () => {
    if (acquisitionIsPending || snapshot.status !== "checking") return
    acquisitionIsPending = true

    void acquireLease().then((lease) => {
      acquisitionIsPending = false
      if (releaseLeaseAfterAcquisition && subscribers.size === 0) {
        if (lease.status === "writer") lease.release()
        releaseLeaseAfterAcquisition = false
        snapshot = WEB_EXCLUSIVE_WRITER_CHECKING
        return
      }

      releaseLeaseAfterAcquisition = false
      snapshot = lease
      notifySubscribers()
    })
  }

  return Object.freeze({
    subscribe: (onStoreChange) => {
      subscribers.add(onStoreChange)
      releaseLeaseAfterAcquisition = false
      startAcquisition()

      return () => {
        subscribers.delete(onStoreChange)
        if (subscribers.size > 0) return

        queueMicrotask(() => {
          if (subscribers.size > 0) return
          if (acquisitionIsPending) {
            releaseLeaseAfterAcquisition = true
            return
          }

          if (snapshot.status === "writer") snapshot.release()
          snapshot = WEB_EXCLUSIVE_WRITER_CHECKING
        })
      }
    },
    getSnapshot: () => snapshot,
  })
}

const webExclusiveWriterCoordinator = createWebExclusiveWriterCoordinator()

export default function useWebExclusiveWriterLease(
  coordinator: WebExclusiveWriterCoordinator = webExclusiveWriterCoordinator,
) {
  return useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  )
}

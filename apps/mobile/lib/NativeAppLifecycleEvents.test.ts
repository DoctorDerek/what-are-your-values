import type { AppStateStatus } from "react-native"
import { describe, expect, it } from "vitest"
import { createNativeAppLifecycleEvent } from "./NativeAppLifecycleEvents"

const NON_BACKGROUND_APP_STATES = Object.freeze([
  "active",
  "inactive",
  "extension",
  "unknown",
] as const satisfies readonly AppStateStatus[])

describe("native app lifecycle events", () => {
  it("requests one durable checkpoint when the native app enters the background", () => {
    expect(createNativeAppLifecycleEvent("background")).toEqual({
      type: "APP.BACKGROUND_CHECKPOINT_REQUESTED",
    })
  })

  it.each(NON_BACKGROUND_APP_STATES)(
    "does not request a checkpoint for the %s state",
    (appState) => {
      expect(createNativeAppLifecycleEvent(appState)).toBeNull()
    },
  )
})

import type { AppStateStatus } from "react-native"

export function createNativeAppLifecycleEvent(appState: AppStateStatus) {
  return appState === "background"
    ? ({ type: "APP.BACKGROUND_CHECKPOINT_REQUESTED" } as const)
    : null
}

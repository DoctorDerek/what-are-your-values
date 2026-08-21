import type { PlayerDataResetReview } from "@game/machines/src/PlayerDataReset"
import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import NativeDataManagement from "@/components/NativeDataManagement"

const preview = Object.freeze({
  exportedAt: "2026-08-06T12:34:56.000Z",
  sourceAppVersion: "0.1.0",
  sourceBuild: "abc123",
  saveSchemaVersion: 1,
  canonicalCatalogVersion: "pvcs-2011-100-v1",
  totalComparisons: 42,
  currentCycle: 3,
  customValueCount: 2,
  customValueNames: Object.freeze(["Ingenuity", "Meaning"]),
  activeValueCount: 102,
  activePairCycleSize: 5_151,
  deckRevision: 2,
  progressGeneration: 1,
  unlockedAchievementCount: 4,
  achievementProgressGeneration: 1,
  locale: "en",
  replacesCurrentLocalData: true,
}) satisfies WayvmImportPreview

const resetReview = Object.freeze({
  resetKind: "reset-achievements",
  confirmationId: "reset-achievements-review",
}) satisfies PlayerDataResetReview

function createCallbacks() {
  return {
    onCancelImport: jest.fn(),
    onCancelReset: jest.fn(),
    onChooseBackup: jest.fn(),
    onClose: jest.fn(),
    onConfirmImport: jest.fn(),
    onConfirmReset: jest.fn(),
    onExport: jest.fn(),
    onOpenMenu: jest.fn(),
    onRequestReset: jest.fn(),
  }
}

async function renderDataManagement(
  overrides: Partial<Parameters<typeof NativeDataManagement>[0]> = {},
) {
  const callbacks = createCallbacks()
  const props = {
    activity: null,
    customValueCount: 0,
    isNavigationPending: false,
    issue: null,
    notice: null,
    preview: null,
    resetReview: null,
    ...callbacks,
    ...overrides,
  } satisfies Parameters<typeof NativeDataManagement>[0]

  await render(<NativeDataManagement {...props} />)
  return { callbacks, props }
}

async function expectNavigationIsInert({
  onClose,
  onOpenMenu,
}: ReturnType<typeof createCallbacks>) {
  const user = userEvent.setup()
  const menu = screen.getByRole("button", { name: "Menu" })
  const close = screen.getByRole("button", { name: "Back to Your Values" })
  expect(menu).toBeDisabled()
  expect(close).toBeDisabled()

  await user.press(menu)
  await user.press(close)

  expect(onOpenMenu).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
}

describe("NativeDataManagement", () => {
  it("routes Menu and Hub navigation when no player-data work is pending", async () => {
    const { callbacks } = await renderDataManagement()
    const user = userEvent.setup()
    const menu = screen.getByRole("button", { name: "Menu" })
    const close = screen.getByRole("button", { name: "Back to Your Values" })
    expect(menu).toBeEnabled()
    expect(close).toBeEnabled()

    await user.press(menu)
    await user.press(close)

    expect(callbacks.onOpenMenu).toHaveBeenCalledTimes(1)
    expect(callbacks.onClose).toHaveBeenCalledTimes(1)
  })

  it("blocks navigation during export work", async () => {
    const { callbacks } = await renderDataManagement({
      activity: "Creating backup…",
    })
    await expectNavigationIsInert(callbacks)
  })

  it("blocks navigation during background checkpointing", async () => {
    const { callbacks } = await renderDataManagement({
      isNavigationPending: true,
    })
    await expectNavigationIsInert(callbacks)
  })

  it("keeps reviewed imports inside Import & Export until resolved", async () => {
    const { callbacks } = await renderDataManagement({ preview })
    const user = userEvent.setup()
    await expectNavigationIsInert(callbacks)

    await user.press(screen.getByRole("button", { name: "Import & Replace" }))
    await user.press(screen.getByRole("button", { name: "Cancel" }))

    expect(callbacks.onConfirmImport).toHaveBeenCalledTimes(1)
    expect(callbacks.onCancelImport).toHaveBeenCalledTimes(1)
  })

  it("keeps reviewed resets inside Import & Export while preserving backup", async () => {
    const { callbacks } = await renderDataManagement({ resetReview })
    const user = userEvent.setup()
    await expectNavigationIsInert(callbacks)

    const exportAction = screen.getByRole("button", { name: "Export Data" })
    expect(exportAction).toBeEnabled()
    await user.press(exportAction)
    await user.press(screen.getByRole("button", { name: "Cancel" }))
    await user.press(screen.getByRole("button", { name: "Reset Achievements" }))

    expect(callbacks.onExport).toHaveBeenCalledTimes(1)
    expect(callbacks.onCancelReset).toHaveBeenCalledTimes(1)
    expect(callbacks.onConfirmReset).toHaveBeenCalledWith(resetReview)
  })
})

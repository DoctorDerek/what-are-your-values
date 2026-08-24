import {
  type PlayerDataResetKind,
  type PlayerDataResetReview,
} from "@game/machines/src/PlayerDataReset"
import {
  createInitialPlayerSettings,
  type PlayerSettings,
} from "@game/machines/src/PlayerSettings"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import Settings from "./Settings"

function renderSettings(
  overrides: Partial<Parameters<typeof Settings>[0]> = {},
) {
  const props = {
    activity: null,
    customValueCount: 2,
    issue: null,
    notice: null,
    resetReview: null,
    settings: createInitialPlayerSettings(),
    onCancelReset: vi.fn(),
    onClose: vi.fn(),
    onConfirmReset: vi.fn(),
    onExport: vi.fn(),
    onOpenMenu: vi.fn(),
    onRequestReset: vi.fn(),
    onUpdateSettings: vi.fn(),
    ...overrides,
  } satisfies Parameters<typeof Settings>[0]

  render(<Settings {...props} />)
  return props
}

describe("Settings", () => {
  it("shows truthful language status and changes preferences only through native radio activation", async () => {
    const props = renderSettings()
    const reducedMotionGroup = screen.getByRole("group", {
      name: "Reduced Motion",
    })
    const controlHintsGroup = screen.getByRole("group", {
      name: "Control Hints",
    })
    const followSystem = within(reducedMotionGroup).getByRole("radio", {
      name: /Follow System/,
    })
    const reduceMotion = within(reducedMotionGroup).getByRole("radio", {
      name: /^On/,
    })
    const alwaysShowHints = within(controlHintsGroup).getByRole("radio", {
      name: /^Always/,
    })

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Settings", level: 1 }),
      ).toHaveFocus(),
    )
    expect(
      within(screen.getByRole("region", { name: "Language" })).getByText(
        "English",
      ),
    ).toBeVisible()
    expect(followSystem).toBeChecked()
    expect(within(reducedMotionGroup).getByText("Selected")).toBeVisible()
    expect(
      within(controlHintsGroup).getByRole("radio", { name: /^Auto/ }),
    ).toBeChecked()
    expect(within(controlHintsGroup).getByText("Selected")).toBeVisible()

    fireEvent.focus(reduceMotion)
    expect(props.onUpdateSettings).not.toHaveBeenCalled()
    fireEvent.click(reduceMotion)
    fireEvent.click(alwaysShowHints)

    expect(props.onUpdateSettings).toHaveBeenNthCalledWith(1, {
      ...props.settings,
      reducedMotion: "on",
    } satisfies PlayerSettings)
    expect(props.onUpdateSettings).toHaveBeenNthCalledWith(2, {
      ...props.settings,
      controlHints: "always",
    } satisfies PlayerSettings)

    fireEvent.click(screen.getByRole("button", { name: "Menu" }))
    fireEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(props.onOpenMenu).toHaveBeenCalledOnce()
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it("announces durable activity and errors while locking every competing action", async () => {
    renderSettings({
      activity: "Saving setting…",
      issue: "The setting could not be saved. Try again.",
      notice: "Achievements were reset.",
    })

    expect(screen.getAllByRole("status")).toHaveLength(2)
    expect(screen.getByText("Saving setting…")).toBeVisible()
    expect(screen.getByText("Achievements were reset.")).toBeVisible()
    await waitFor(() => expect(screen.getByRole("alert")).toHaveFocus())
    expect(screen.getByRole("button", { name: "Menu" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled()
    for (const preference of screen.getAllByRole("radio")) {
      expect(preference).toBeDisabled()
    }
    expect(
      screen.getByRole("button", { name: "Reset Levels & Experience" }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Reset Achievements" }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Delete All Data" }),
    ).toBeDisabled()
  })

  it("offers the exact Settings reset subset and restores the invoking action after review", async () => {
    const onConfirmReset = vi.fn()
    const onExport = vi.fn()

    function ResetReviewHarness() {
      const [resetReview, setResetReview] =
        useState<PlayerDataResetReview | null>(null)

      const openReview = (resetKind: PlayerDataResetKind) =>
        setResetReview({
          resetKind,
          confirmationId: `${resetKind}-settings-review`,
        })

      return (
        <Settings
          activity={null}
          customValueCount={2}
          issue={null}
          notice={null}
          resetReview={resetReview}
          settings={createInitialPlayerSettings()}
          onCancelReset={() => setResetReview(null)}
          onClose={vi.fn()}
          onConfirmReset={(review) => {
            onConfirmReset(review)
            setResetReview(null)
          }}
          onExport={onExport}
          onOpenMenu={vi.fn()}
          onRequestReset={openReview}
          onUpdateSettings={vi.fn()}
        />
      )
    }

    render(<ResetReviewHarness />)
    expect(
      screen.queryByRole("button", { name: "Delete All Custom Values" }),
    ).toBeNull()
    const getAchievementsAction = () =>
      screen.getByRole("button", { name: "Reset Achievements" })
    const achievementsAction = getAchievementsAction()
    fireEvent.click(achievementsAction)

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Reset Achievements?" }),
      ).toHaveFocus(),
    )
    expect(screen.getByRole("button", { name: "Menu" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Export Data" }))
    expect(onExport).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(getAchievementsAction()).toHaveFocus())

    fireEvent.click(getAchievementsAction())
    const reviewedReset = screen.getByRole("button", {
      name: "Reset Achievements",
    })
    fireEvent.click(reviewedReset)
    expect(onConfirmReset).toHaveBeenCalledWith({
      resetKind: "reset-achievements",
      confirmationId: "reset-achievements-settings-review",
    })
    await waitFor(() => expect(getAchievementsAction()).toHaveFocus())
  })
})

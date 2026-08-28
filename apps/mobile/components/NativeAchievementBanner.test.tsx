import { readAchievementId } from "@game/machines/src/AchievementCatalog"
import type { AchievementPresentation } from "@game/machines/src/AchievementPresentation"
import { afterEach, describe, expect, it, jest } from "@jest/globals"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import NativeAchievementBanner from "@/components/NativeAchievementBanner"

const firstBattle = Object.freeze({
  id: readAchievementId("battle.first", "Native achievement banner test ID"),
  title: "First Battle",
  requirement: "Compare your first pair of values.",
  status: "unlocked",
  progress: null,
  unlockedAt: "2026-08-28T12:00:00.000Z",
  unlockedDate: "Aug 28, 2026",
}) satisfies AchievementPresentation

const fiveBattles = Object.freeze({
  ...firstBattle,
  id: readAchievementId("battle.5", "Native achievement banner test ID"),
  title: "5 Battles",
  requirement: "Compare 5 pairs of values.",
}) satisfies AchievementPresentation

describe("NativeAchievementBanner", () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it("renders nothing when no achievement is awaiting presentation", async () => {
    const onPresented = jest.fn()
    const { toJSON } = await render(
      <NativeAchievementBanner
        achievement={null}
        isAcknowledgementPending={false}
        shouldReduceMotion={false}
        onPresented={onPresented}
      />,
    )

    expect(toJSON()).toBeNull()
    expect(onPresented).not.toHaveBeenCalled()
  })

  it("announces screen banners and records the eight-second presentation", async () => {
    jest.useFakeTimers()
    const onPresented = jest.fn()
    await render(
      <NativeAchievementBanner
        achievement={firstBattle}
        isAcknowledgementPending={false}
        shouldReduceMotion={false}
        onPresented={onPresented}
      />,
    )

    const banner = screen.getByLabelText("Achievement unlocked: First Battle")
    expect(banner).toHaveProp("accessibilityLiveRegion", "polite")
    expect(banner.props.className).toContain("absolute")
    expect(banner).toHaveStyle({ bottom: 12 })
    expect(onPresented).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(8_000)
      await Promise.resolve()
    })

    expect(onPresented).toHaveBeenCalledWith(firstBattle.id)
  })

  it("keeps battle placement in flow and removes decorative motion", async () => {
    jest.useFakeTimers()
    const onPresented = jest.fn()
    await render(
      <NativeAchievementBanner
        achievement={firstBattle}
        isAcknowledgementPending={false}
        placement="battle"
        shouldReduceMotion
        onPresented={onPresented}
      />,
    )

    const banner = screen.getByLabelText("Achievement unlocked: First Battle")
    expect(banner.props.className).toContain("mx-3")
    expect(banner.props.className).not.toContain("absolute")
    expect(banner).toHaveStyle({
      opacity: 1,
      transform: [{ translateY: 0 }],
    })
    await act(async () => {
      jest.advanceTimersByTime(8_000)
      await Promise.resolve()
    })

    expect(onPresented).toHaveBeenCalledWith(firstBattle.id)
  })

  it("blocks duplicate acknowledgement while persistence is pending", async () => {
    jest.useFakeTimers()
    const onPresented = jest.fn()
    await render(
      <NativeAchievementBanner
        achievement={firstBattle}
        isAcknowledgementPending
        shouldReduceMotion={false}
        onPresented={onPresented}
      />,
    )

    const dismiss = screen.getByRole("button", {
      name: "Dismiss achievement",
    })
    expect(dismiss).toBeDisabled()
    await fireEvent.press(dismiss)
    await act(async () => {
      jest.advanceTimersByTime(8_000)
      await Promise.resolve()
    })

    expect(onPresented).not.toHaveBeenCalled()
  })

  it("acknowledges explicit dismissal and restarts for the next unlock", async () => {
    jest.useFakeTimers()
    const onPresented = jest.fn()
    const { rerender } = await render(
      <NativeAchievementBanner
        achievement={firstBattle}
        isAcknowledgementPending={false}
        shouldReduceMotion={false}
        onPresented={onPresented}
      />,
    )

    await fireEvent.press(
      screen.getByRole("button", { name: "Dismiss achievement" }),
    )
    expect(onPresented).toHaveBeenLastCalledWith(firstBattle.id)
    expect(onPresented).toHaveBeenCalledTimes(1)

    await rerender(
      <NativeAchievementBanner
        achievement={firstBattle}
        isAcknowledgementPending
        shouldReduceMotion={false}
        onPresented={onPresented}
      />,
    )

    await rerender(
      <NativeAchievementBanner
        achievement={fiveBattles}
        isAcknowledgementPending={false}
        shouldReduceMotion={false}
        onPresented={onPresented}
      />,
    )

    await act(async () => {
      jest.advanceTimersByTime(8_000)
      await Promise.resolve()
    })

    expect(onPresented).toHaveBeenLastCalledWith(fiveBattles.id)
    expect(screen.getByText("5 Battles")).toBeOnTheScreen()
  })
})

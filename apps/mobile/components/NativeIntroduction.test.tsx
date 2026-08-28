import { introductionCopy } from "@game/data/src/IntroductionCopy"
import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import NativeIntroduction from "@/components/NativeIntroduction"

describe("NativeIntroduction", () => {
  it("presents the approved first-run guidance and completes explicitly", async () => {
    const onComplete = jest.fn()
    const user = userEvent.setup()
    await render(<NativeIntroduction onComplete={onComplete} />)

    expect(
      screen.getByRole("heading", { name: introductionCopy.title }),
    ).toBeOnTheScreen()
    expect(screen.getByText(introductionCopy.tagline)).toBeOnTheScreen()
    expect(screen.getByText(introductionCopy.body[0])).toBeOnTheScreen()
    expect(screen.getByText(introductionCopy.body.at(-1)!)).toBeOnTheScreen()
    expect(screen.queryByText("Recovered player data.")).toBeNull()

    await user.press(
      screen.getByRole("button", { name: introductionCopy.startAction }),
    )

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("announces an optional first-run notice without changing the Start action", async () => {
    const onComplete = jest.fn()
    const user = userEvent.setup()
    await render(
      <NativeIntroduction
        notice="Recovered player data."
        onComplete={onComplete}
      />,
    )

    expect(screen.getByText("Recovered player data.")).toHaveProp(
      "accessibilityLiveRegion",
      "polite",
    )

    await user.press(
      screen.getByRole("button", { name: introductionCopy.startAction }),
    )

    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})

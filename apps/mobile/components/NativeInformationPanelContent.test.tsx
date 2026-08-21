import {
  FREE_RESOURCES_INFORMATION_PANEL,
  HOW_IT_WORKS_INFORMATION_PANEL,
  WHY_I_MADE_THIS_GAME_INFORMATION_PANEL,
} from "@game/data/src/InformationPanels"
import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import { Linking } from "react-native"
import NativeInformationPanelContent from "@/components/NativeInformationPanelContent"

describe("NativeInformationPanelContent", () => {
  it("renders every approved text-block kind from shared definitions", async () => {
    const { rerender } = await render(
      <NativeInformationPanelContent
        informationPanel={HOW_IT_WORKS_INFORMATION_PANEL}
      />,
    )

    expect(
      screen.getByText(
        "WAYVM turns values clarification into a simple game: choose which of two values matters more to you right now.",
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByText("Start With 100 Values—or Add Your Own"),
    ).toBeOnTheScreen()
    expect(
      screen.getByText(
        "There is no correct ranking. Your values belong to you.",
      ),
    ).toBeOnTheScreen()

    await rerender(
      <NativeInformationPanelContent
        informationPanel={WHY_I_MADE_THIS_GAME_INFORMATION_PANEL}
      />,
    )

    expect(screen.getByText("—Dr. Derek Austin")).toBeOnTheScreen()
  })

  it("opens only the explicitly selected canonical external resource", async () => {
    const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined)
    const user = userEvent.setup()
    await render(
      <NativeInformationPanelContent
        informationPanel={FREE_RESOURCES_INFORMATION_PANEL}
      />,
    )

    const resourceActions = screen.getAllByRole("link")
    expect(resourceActions).toHaveLength(7)
    expect(openUrl).not.toHaveBeenCalled()

    await user.press(screen.getByRole("link", { name: "Open WHO Resource" }))

    expect(openUrl).toHaveBeenCalledTimes(1)
    expect(openUrl).toHaveBeenCalledWith(
      "https://www.who.int/europe/publications/i/item/9789240003910",
    )
  })
})

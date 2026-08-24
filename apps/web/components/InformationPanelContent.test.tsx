import {
  FREE_RESOURCES_INFORMATION_PANEL,
  HOW_IT_WORKS_INFORMATION_PANEL,
  WHY_I_MADE_THIS_GAME_INFORMATION_PANEL,
} from "@game/data/src/InformationPanels"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import InformationPanelContent from "@/components/InformationPanelContent"

describe("InformationPanelContent", () => {
  it("renders approved sections and creator attribution semantically", () => {
    const { rerender } = render(
      <InformationPanelContent
        informationPanel={HOW_IT_WORKS_INFORMATION_PANEL}
      />,
    )

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(9)
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Treat the Result as a Reflection, Not a Verdict",
      }),
    ).toBeInTheDocument()

    rerender(
      <InformationPanelContent
        informationPanel={WHY_I_MADE_THIS_GAME_INFORMATION_PANEL}
      />,
    )
    expect(screen.getByText("—Dr. Derek Austin")).toHaveClass("text-right")
  })

  it("renders exactly seven explicit isolated external resource actions", () => {
    render(
      <InformationPanelContent
        informationPanel={FREE_RESOURCES_INFORMATION_PANEL}
      />,
    )

    const resourceLinks = screen.getAllByRole("link")
    expect(resourceLinks).toHaveLength(7)

    for (const resourceLink of resourceLinks) {
      expect(resourceLink).toHaveAttribute(
        "href",
        expect.stringMatching(/^https:\/\//),
      )
      expect(resourceLink).toHaveAttribute("target", "_blank")
      expect(resourceLink).toHaveAttribute("rel", "noopener noreferrer")
    }

    expect(
      screen.getByText(
        "External links require internet access and are governed by each destination’s privacy and accessibility practices.",
      ),
    ).toBeInTheDocument()
  })
})

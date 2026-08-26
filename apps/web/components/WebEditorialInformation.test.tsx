import {
  INFORMATION_PANEL_IDS,
  INFORMATION_PANELS,
} from "@game/data/src/InformationPanels"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import WebEditorialInformation from "@/components/WebEditorialInformation"

function getEditorialSectionTitle(
  informationPanelId: (typeof INFORMATION_PANEL_IDS)[number],
) {
  return informationPanelId === "introduction"
    ? "Introduction"
    : INFORMATION_PANELS[informationPanelId].title
}

describe("WebEditorialInformation", () => {
  it("renders the canonical information hierarchy and every approved block", () => {
    render(<WebEditorialInformation />)

    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map(({ textContent }) => textContent),
    ).toEqual(INFORMATION_PANEL_IDS.map(getEditorialSectionTitle))

    for (const informationPanelId of INFORMATION_PANEL_IDS) {
      const informationPanel = INFORMATION_PANELS[informationPanelId]
      const sectionTitle = getEditorialSectionTitle(informationPanelId)
      const informationSection = screen.getByRole("region", {
        name: sectionTitle,
      })
      const informationSectionQueries = within(informationSection)

      expect(informationSection).toHaveAttribute("id", informationPanelId)
      expect(informationSection).toHaveAttribute(
        "aria-labelledby",
        `${informationPanelId}-title`,
      )

      for (const block of informationPanel.blocks) {
        if (block.kind === "section") {
          expect(
            informationSectionQueries.getByRole("heading", {
              level: 3,
              name: block.heading,
            }),
          ).toBeVisible()
          for (const paragraph of block.paragraphs)
            expect(informationSectionQueries.getByText(paragraph)).toBeVisible()
          continue
        }

        if (block.kind === "resource") {
          expect(
            informationSectionQueries.getByRole("heading", {
              level: 3,
              name: block.title,
            }),
          ).toBeVisible()
          expect(
            informationSectionQueries.getByText(block.description),
          ).toBeVisible()
          continue
        }

        expect(informationSectionQueries.getByText(block.text)).toBeVisible()
      }
    }
  })

  it("preserves every isolated external resource destination", () => {
    render(<WebEditorialInformation />)

    const approvedResourceBlocks = INFORMATION_PANEL_IDS.flatMap(
      (informationPanelId) =>
        INFORMATION_PANELS[informationPanelId].blocks.filter(
          (block) => block.kind === "resource",
        ),
    )
    const resourceLinks = screen.getAllByRole("link")

    expect(approvedResourceBlocks).toHaveLength(7)
    expect(resourceLinks).toHaveLength(approvedResourceBlocks.length)

    for (const resourceBlock of approvedResourceBlocks) {
      const resourceLink = screen.getByRole("link", {
        name: resourceBlock.actionLabel,
      })

      expect(resourceLink).toHaveAttribute("href", resourceBlock.url)
      expect(resourceLink).toHaveAttribute("target", "_blank")
      expect(resourceLink).toHaveAttribute("rel", "noopener noreferrer")
      expect(new URL(resourceBlock.url).protocol).toBe("https:")
    }
  })

  it("keeps the complete private offline disclosure visible", () => {
    render(<WebEditorialInformation />)

    const creditsPrivacySection = screen.getByRole("region", {
      name: "Credits & Privacy",
    })
    const privateOfflineBlock = INFORMATION_PANELS[
      "credits-privacy"
    ].blocks.find(
      (block) =>
        block.kind === "section" &&
        block.heading === "Private. Offline. Account-free.",
    )

    expect(privateOfflineBlock).toBeDefined()
    if (privateOfflineBlock?.kind !== "section")
      throw new Error("Private offline disclosure is missing")

    expect(
      within(creditsPrivacySection).getByRole("heading", {
        level: 3,
        name: privateOfflineBlock.heading,
      }),
    ).toBeVisible()
    for (const paragraph of privateOfflineBlock.paragraphs)
      expect(within(creditsPrivacySection).getByText(paragraph)).toBeVisible()
  })
})

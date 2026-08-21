import { describe, expect, it } from "vitest"
import {
  FREE_RESOURCES_INFORMATION_PANEL,
  INFORMATION_PANEL_IDS,
  INFORMATION_PANELS,
  INTRODUCTION_INFORMATION_PANEL,
  type InformationPanelResourceBlock,
} from "./InformationPanels"
import { introductionCopy } from "./IntroductionCopy"

describe("Information Panel Catalog", () => {
  it("owns every shipped panel in the approved immutable order", () => {
    const expectedAccessibleCloseLabels = Object.freeze({
      introduction: "Close Introduction",
      "how-it-works": "Close How It Works",
      "why-values-matter": "Close Why Values Matter",
      "why-i-made-this-game": "Close Why I Made This Game",
      "free-resources": "Close Free Resources",
      "credits-privacy": "Close Credits & Privacy",
    } as const)

    expect(INFORMATION_PANEL_IDS).toEqual([
      "introduction",
      "how-it-works",
      "why-values-matter",
      "why-i-made-this-game",
      "free-resources",
      "credits-privacy",
    ])
    expect(Object.keys(INFORMATION_PANELS)).toEqual(INFORMATION_PANEL_IDS)
    expect(Object.isFrozen(INFORMATION_PANEL_IDS)).toBe(true)
    expect(Object.isFrozen(INFORMATION_PANELS)).toBe(true)

    for (const informationPanelId of INFORMATION_PANEL_IDS) {
      const informationPanel = INFORMATION_PANELS[informationPanelId]

      expect(informationPanel.id).toBe(informationPanelId)
      expect(informationPanel.primaryActionLabel).toBe("Close")
      expect(informationPanel.accessibleCloseLabel).toBe(
        expectedAccessibleCloseLabels[informationPanelId],
      )
      expect(Object.isFrozen(informationPanel)).toBe(true)
      expect(Object.isFrozen(informationPanel.blocks)).toBe(true)

      for (const block of informationPanel.blocks) {
        expect(Object.isFrozen(block)).toBe(true)
        if (block.kind === "section")
          expect(Object.isFrozen(block.paragraphs)).toBe(true)
      }
    }
  })

  it("builds reopened Introduction from the canonical first-launch copy", () => {
    expect(INTRODUCTION_INFORMATION_PANEL.title).toBe(introductionCopy.title)
    expect(INTRODUCTION_INFORMATION_PANEL.accessibleCloseLabel).toBe(
      introductionCopy.accessibleCloseLabel,
    )
    expect(INTRODUCTION_INFORMATION_PANEL.primaryActionLabel).toBe(
      introductionCopy.closeAction,
    )
    expect(INTRODUCTION_INFORMATION_PANEL.blocks).toEqual([
      { kind: "lead", text: introductionCopy.tagline },
      ...introductionCopy.body.map((text) => ({ kind: "paragraph", text })),
    ])
  })

  it("exposes exactly seven unique HTTPS resources without future copy", () => {
    const resourceBlocks = FREE_RESOURCES_INFORMATION_PANEL.blocks.filter(
      (block): block is InformationPanelResourceBlock =>
        block.kind === "resource",
    )

    expect(resourceBlocks).toHaveLength(7)
    expect(new Set(resourceBlocks.map(({ url }) => url)).size).toBe(7)

    for (const resource of resourceBlocks) {
      expect(new URL(resource.url).protocol).toBe("https:")
      expect(resource.actionLabel).toMatch(/^(Open|Visit|Read)/)
    }

    expect(
      INFORMATION_PANELS["credits-privacy"].blocks.some(
        (block) => "text" in block && block.text.includes("PNG export"),
      ),
    ).toBe(false)
  })
})

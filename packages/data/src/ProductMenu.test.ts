import { describe, expect, it } from "vitest"
import { PRODUCT_MENU_COPY, PRODUCT_MENU_DESTINATIONS } from "./ProductMenu"

describe("Product Menu", () => {
  it("owns the exact context-action copy", () => {
    expect(PRODUCT_MENU_COPY).toEqual({
      title: "Menu",
      openAction: "Menu",
      closeAction: "Close Menu",
      resumeBattleAction: "Resume Battle",
    })
    expect(Object.isFrozen(PRODUCT_MENU_COPY)).toBe(true)
  })

  it("lists each currently shipped destination once in canonical order", () => {
    expect(PRODUCT_MENU_DESTINATIONS).toEqual([
      {
        kind: "route",
        id: "browse-all-values",
        label: "Browse All Values",
      },
      { kind: "route", id: "custom-values", label: "Custom Values" },
      { kind: "route", id: "achievements", label: "Achievements" },
      { kind: "route", id: "controls", label: "Controls" },
      { kind: "route", id: "import-export", label: "Import & Export" },
      {
        kind: "information-panel",
        id: "introduction",
        label: "Introduction",
      },
      {
        kind: "information-panel",
        id: "how-it-works",
        label: "How It Works",
      },
      {
        kind: "information-panel",
        id: "why-values-matter",
        label: "Why Values Matter",
      },
      {
        kind: "information-panel",
        id: "why-i-made-this-game",
        label: "Why I Made This Game",
      },
      {
        kind: "information-panel",
        id: "free-resources",
        label: "Free Resources",
      },
      {
        kind: "information-panel",
        id: "credits-privacy",
        label: "Credits & Privacy",
      },
    ])
    expect(new Set(PRODUCT_MENU_DESTINATIONS.map(({ id }) => id)).size).toBe(
      PRODUCT_MENU_DESTINATIONS.length,
    )
    expect(Object.isFrozen(PRODUCT_MENU_DESTINATIONS)).toBe(true)
    expect(
      PRODUCT_MENU_DESTINATIONS.every((destination) =>
        Object.isFrozen(destination),
      ),
    ).toBe(true)
  })

  it("excludes unfinished product surfaces", () => {
    const unavailableDestinationIds = [
      "settings",
      "customize-avatar",
      "share-top-five",
      "platform-achievements",
      "audio",
    ]
    const availableDestinationIds = new Set<string>(
      PRODUCT_MENU_DESTINATIONS.map(({ id }) => id),
    )

    expect(
      unavailableDestinationIds.every(
        (destinationId) => !availableDestinationIds.has(destinationId),
      ),
    ).toBe(true)
  })
})

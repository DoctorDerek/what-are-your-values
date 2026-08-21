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
      { id: "browse-all-values", label: "Browse All Values" },
      { id: "custom-values", label: "Custom Values" },
      { id: "achievements", label: "Achievements" },
      { id: "import-export", label: "Import & Export" },
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
      "controls",
      "introduction",
      "how-it-works",
      "why-values-matter",
      "why-i-made-this-game",
      "free-resources",
      "credits-privacy",
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

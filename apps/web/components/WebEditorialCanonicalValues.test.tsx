import { CANONICAL_VALUES } from "@game/data/src/CanonicalValues"
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import WebEditorialCanonicalValues from "@/components/WebEditorialCanonicalValues"

describe("WebEditorialCanonicalValues", () => {
  it("renders exactly the frozen public catalog in source order", () => {
    render(<WebEditorialCanonicalValues />)

    const canonicalValuesSection = screen.getByRole("region", {
      name: "100 Included Values",
    })
    const canonicalValueTerms = within(canonicalValuesSection).getAllByRole(
      "term",
    )
    const canonicalValueDefinitions = within(
      canonicalValuesSection,
    ).getAllByRole("definition")
    const renderedCanonicalNames = canonicalValueTerms.map(
      ({ textContent }) => textContent,
    )
    const renderedCanonicalDefinitions = canonicalValueDefinitions.map(
      ({ textContent }) => textContent,
    )

    expect(canonicalValuesSection).toHaveAttribute("id", "included-values")
    expect(canonicalValuesSection).toHaveAttribute(
      "aria-labelledby",
      "included-values-title",
    )
    expect(canonicalValueTerms).toHaveLength(100)
    expect(canonicalValueDefinitions).toHaveLength(100)
    expect(renderedCanonicalNames).toEqual(
      CANONICAL_VALUES.map(({ englishName }) => englishName),
    )
    expect(renderedCanonicalDefinitions).toEqual(
      CANONICAL_VALUES.map(({ sourceDefinition }) => sourceDefinition),
    )
    expect(new Set(renderedCanonicalNames).size).toBe(CANONICAL_VALUES.length)
  })
})

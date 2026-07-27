import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import RootLayout, { metadata } from "./layout"

describe("Root layout", () => {
  it("exposes the product metadata and accessible document language", () => {
    render(
      <RootLayout>
        <p>Values client</p>
      </RootLayout>,
    )

    expect(metadata).toMatchObject({
      title:
        "What Are Your Values, Mapache? A Free Game To Find What You Value in Life",
      description:
        "What Are Your Values, Mapache? is a fast-paced, value-sorting autobattler to help you find out what you value in life.",
    })
    expect(document.documentElement).toHaveAttribute("lang", "en")
    expect(screen.getByText("Values client")).toBeVisible()
  })
})

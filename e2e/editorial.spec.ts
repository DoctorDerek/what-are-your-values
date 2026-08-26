import { expect, test } from "@playwright/test"

test.describe("static English editorial document", () => {
  test.use({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 720 },
  })

  test("remains useful and reflows when client JavaScript is unavailable", async ({
    page,
  }) => {
    await page.goto("/")

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "What Are Your Values, Mapache?",
      }),
    ).toBeVisible()
    const gameFallback = page.getByRole("main", { name: "Loading game" })
    await expect(
      gameFallback.getByText(
        "A high-speed autobattler designed to help you find your values in life.",
      ),
    ).toBeVisible()
    await expect(
      page.getByText("The interactive game requires JavaScript."),
    ).toBeVisible()

    await page.getByRole("link", { name: "Read the Introduction" }).click()
    await expect(page).toHaveURL(/#introduction$/)

    const editorialArticle = page.getByRole("article", {
      name: "What Are Your Values, Mapache? information",
    })
    await expect(
      editorialArticle.getByRole("heading", {
        level: 2,
        name: "Introduction",
      }),
    ).toBeVisible()
    await expect(editorialArticle.locator("dt")).toHaveCount(100)
    await expect(editorialArticle.locator("dd")).toHaveCount(100)
    await expect(editorialArticle.locator("dt").first()).toHaveText(
      "Acceptance",
    )
    await expect(editorialArticle.locator("dd").first()).toHaveText(
      "to be accepted as I am",
    )
    await expect(editorialArticle.locator("dt").last()).toHaveText(
      "World Peace",
    )
    await expect(editorialArticle.locator("dd").last()).toHaveText(
      "to work to promote peace in the world",
    )
    await expect(
      editorialArticle.getByRole("link", { name: "Start or Continue Game" }),
    ).toHaveAttribute("href", "#game")
    await expect(
      editorialArticle.getByRole("link", { name: "Report a Problem" }),
    ).toHaveAttribute("href", "mailto:derekraustin+wayvm@gmail.com")

    const documentGeometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ),
    }))

    expect(documentGeometry.scrollWidth).toBeLessThanOrEqual(
      documentGeometry.clientWidth,
    )
  })
})

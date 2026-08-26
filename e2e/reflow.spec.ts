import { expect, test, type Page } from "@playwright/test"

test.use({ viewport: { width: 320, height: 720 } })

async function expectNoDocumentHorizontalOverflow(
  page: Page,
  productState: string,
) {
  const geometry = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ),
  }))

  expect(
    geometry.documentScrollWidth,
    `${productState} document width ${geometry.documentScrollWidth}px exceeded its ${geometry.documentClientWidth}px viewport`,
  ).toBeLessThanOrEqual(geometry.documentClientWidth)
}

async function startAtHub(page: Page) {
  await page.goto("/")
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "What Are Your Values, Mapache?",
    }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Your Values" }),
  ).toBeVisible()
}

async function openMenuDestination(page: Page, destinationName: string) {
  await page.getByRole("button", { name: "Menu", exact: true }).click()
  const menu = page.getByRole("dialog", { name: "Menu" })
  await expect(menu).toBeVisible()
  await menu.getByRole("button", { name: destinationName, exact: true }).click()
}

test("Introduction Hub Crucible and achievement feedback reflow without document overflow", async ({
  page,
}) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "What Are Your Values, Mapache?",
    }),
  ).toBeVisible()
  await expectNoDocumentHorizontalOverflow(page, "Introduction")

  await page.getByRole("button", { name: "Start", exact: true }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Your Values" }),
  ).toBeVisible()
  await expectNoDocumentHorizontalOverflow(page, "first-run Hub")

  await page.getByRole("button", { name: "Battle", exact: true }).click()
  await expect(page.getByRole("main", { name: "Value battle" })).toBeVisible()
  await expectNoDocumentHorizontalOverflow(page, "active Crucible")

  await page
    .getByRole("button", { name: /^Choose / })
    .first()
    .click()
  const achievementBanner = page.getByLabel("Achievement unlocked")
  await expect(achievementBanner).toBeVisible()
  await expect(achievementBanner).toHaveCSS("opacity", "1")
  await expectNoDocumentHorizontalOverflow(page, "achievement feedback")
})

test("All Values and Custom Values reflow without document overflow", async ({
  page,
}) => {
  await startAtHub(page)
  await page
    .getByRole("button", { name: "Browse All Values", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { level: 1, name: "All Values" }),
  ).toBeVisible()
  await expectNoDocumentHorizontalOverflow(page, "All Values")

  await page
    .getByRole("button", { name: "Add Custom Value", exact: true })
    .click()
  await expect(
    page.getByRole("form", { name: "Add Custom Value" }),
  ).toBeVisible()
  await expectNoDocumentHorizontalOverflow(page, "Custom Value builder")
})

test("Menu Controls Settings and reset confirmation reflow without document overflow", async ({
  page,
}) => {
  await startAtHub(page)

  await page.getByRole("button", { name: "Menu", exact: true }).click()
  const menu = page.getByRole("dialog", { name: "Menu" })
  await expect(menu).toBeVisible()
  await expectNoDocumentHorizontalOverflow(page, "Menu")
  await menu.getByRole("button", { name: "Controls", exact: true }).click()

  const controls = page.getByRole("dialog", { name: "Controls" })
  await expect(controls).toBeVisible()
  await expectNoDocumentHorizontalOverflow(page, "Controls")
  await controls
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click()

  await openMenuDestination(page, "Settings")
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible()
  await expectNoDocumentHorizontalOverflow(page, "Settings")

  await page.getByRole("button", { name: "Reset Levels & Experience" }).click()
  await expect(
    page.getByRole("heading", { name: "Reset Levels & Experience?" }),
  ).toBeVisible()
  await expectNoDocumentHorizontalOverflow(
    page,
    "Reset Levels & Experience confirmation",
  )
})

test("Achievements and Import Export reflow without document overflow", async ({
  page,
}) => {
  await startAtHub(page)

  await openMenuDestination(page, "Achievements")
  await expect(
    page.getByRole("heading", { level: 1, name: "Achievements" }),
  ).toBeVisible()
  await expectNoDocumentHorizontalOverflow(page, "Achievements")

  await openMenuDestination(page, "Import & Export")
  await expect(
    page.getByRole("heading", { level: 1, name: "Import & Export" }),
  ).toBeVisible()
  await expectNoDocumentHorizontalOverflow(page, "Import & Export")
})

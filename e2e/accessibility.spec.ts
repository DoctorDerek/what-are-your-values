import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const WCAG_AA_RULE_TAGS = Object.freeze([
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
] as const)

async function expectNoAccessibilityViolations(
  page: Page,
  productState: string,
) {
  const { violations } = await new AxeBuilder({ page })
    .withTags([...WCAG_AA_RULE_TAGS])
    .analyze()
  const violationEvidence = violations.map(
    ({ help, helpUrl, id, impact, nodes }) => ({
      help,
      helpUrl,
      id,
      impact,
      targets: nodes.map(({ target }) => target),
    }),
  )

  expect(
    violations,
    `${productState} accessibility violations:\n${JSON.stringify(violationEvidence, null, 2)}`,
  ).toEqual([])
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

test("Introduction and Hub meet automated accessibility rules", async ({
  page,
}) => {
  await page.goto("/")
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "What Are Your Values, Mapache?",
    }),
  ).toBeVisible()
  await expectNoAccessibilityViolations(page, "Introduction")

  await page.getByRole("button", { name: "Start", exact: true }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Your Values" }),
  ).toBeVisible()
  await expectNoAccessibilityViolations(page, "first-run Hub")
})

test("Menu and guidance meet automated accessibility rules", async ({
  page,
}) => {
  await startAtHub(page)

  await page.getByRole("button", { name: "Menu", exact: true }).click()
  const menu = page.getByRole("dialog", { name: "Menu" })
  await expect(menu).toBeVisible()
  await expectNoAccessibilityViolations(page, "open Menu")
  await menu.getByRole("button", { name: "How It Works" }).click()

  const howItWorks = page.getByRole("dialog", { name: "How It Works" })
  await expect(howItWorks).toBeVisible()
  await expectNoAccessibilityViolations(page, "How It Works panel")
  await howItWorks
    .getByRole("button", { name: "Close How It Works" })
    .last()
    .click()
})

test("Controls and Settings meet automated accessibility rules", async ({
  page,
}) => {
  await startAtHub(page)

  await openMenuDestination(page, "Controls")
  const controls = page.getByRole("dialog", { name: "Controls" })
  await expect(controls).toBeVisible()
  await expectNoAccessibilityViolations(page, "Controls")
  await controls
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click()

  await openMenuDestination(page, "Settings")
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible()
  await expectNoAccessibilityViolations(page, "Settings")

  await page.getByRole("button", { name: "Reset Levels & Experience" }).click()
  await expect(
    page.getByRole("heading", { name: "Reset Levels & Experience?" }),
  ).toBeVisible()
  await expectNoAccessibilityViolations(
    page,
    "Reset Levels & Experience confirmation",
  )
})

test("values and player-data surfaces meet automated accessibility rules", async ({
  page,
}) => {
  await startAtHub(page)

  await openMenuDestination(page, "Browse All Values")
  await expect(
    page.getByRole("heading", { level: 1, name: "All Values" }),
  ).toBeVisible()
  await expectNoAccessibilityViolations(page, "Browse All Values")

  await openMenuDestination(page, "Custom Values")
  const customValueForm = page.getByRole("form", {
    name: "Add Custom Value",
  })
  await expect(customValueForm).toBeVisible()
  await expectNoAccessibilityViolations(page, "Custom Value builder")
  await customValueForm.getByRole("button", { name: "Cancel" }).click()

  await openMenuDestination(page, "Achievements")
  await expect(
    page.getByRole("heading", { level: 1, name: "Achievements" }),
  ).toBeVisible()
  await expectNoAccessibilityViolations(page, "Achievements")

  await openMenuDestination(page, "Import & Export")
  await expect(
    page.getByRole("heading", { level: 1, name: "Import & Export" }),
  ).toBeVisible()
  await expectNoAccessibilityViolations(page, "Import & Export")
})

test("battle and achievement feedback meet automated accessibility rules", async ({
  page,
}) => {
  await startAtHub(page)
  await page.getByRole("button", { name: "Battle", exact: true }).click()
  await expect(page.getByRole("main", { name: "Value battle" })).toBeVisible()
  await expectNoAccessibilityViolations(page, "active Crucible")

  await page
    .getByRole("button", { name: /^Choose / })
    .first()
    .click()
  const achievementBanner = page.getByLabel("Achievement unlocked")
  await expect(achievementBanner).toBeVisible()
  await expect(achievementBanner).toHaveCSS("opacity", "1")
  await expectNoAccessibilityViolations(page, "battle achievement feedback")
})

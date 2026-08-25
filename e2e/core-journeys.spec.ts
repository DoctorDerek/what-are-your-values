import { expect, test, type Locator } from "@playwright/test"

const getChoiceValueName = async (choice: Locator) => {
  const valueName = await choice
    .getByRole("heading", { level: 2 })
    .textContent()

  if (!valueName) throw new Error("The projected choice is missing its name")

  return valueName
}

test("a new player starts immediately and reviews the complete ranking", async ({
  page,
}) => {
  await page.goto("/")

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "What Are Your Values, Mapache?",
    }),
  ).toBeVisible()
  await expect(
    page.getByText(
      "Private. Offline. Account-free. Your choices and Custom Values stay on this device unless you choose to export them.",
    ),
  ).toBeVisible()

  await page.getByRole("button", { name: "Start" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Your Values" }),
  ).toBeVisible()
  await expect(
    page.getByText(
      "Not ranked yet. Browse the included values, then battle when you are ready.",
    ),
  ).toBeVisible()

  await page.getByRole("button", { name: "Browse All Values" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "All Values" }),
  ).toBeVisible()
  await expect(page.getByText("100 Active Values")).toBeVisible()
  await expect(page.getByRole("listitem")).toHaveCount(100)

  await page
    .getByRole("searchbox", { name: "Search All Values" })
    .fill("health")
  await expect(page.getByRole("listitem")).toHaveCount(1)
  await expect(page.getByRole("heading", { name: "Health" })).toBeVisible()

  await page.getByRole("button", { name: "Close" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Your Values" }),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Browse All Values" }),
  ).toBeFocused()
})

test("a returning player keeps Undo and Redo across reloads", async ({
  page,
}) => {
  await page.goto("/")

  await page.getByRole("button", { name: "Start" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "Your Values" }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Battle" }).click()
  await expect(page.getByRole("main", { name: "Value battle" })).toBeVisible()

  const firstChoice = page.getByRole("button", { name: /^Choose / }).first()
  const firstChoiceName = await getChoiceValueName(firstChoice)

  await expect(firstChoice).toHaveAccessibleDescription(/^“.+”$/)
  await expect(firstChoice.locator("p")).toBeVisible()
  await expect(page.locator("details")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /^Choose / })).toHaveCount(2)

  await firstChoice.click()
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled()
  await page.getByRole("button", { name: "Undo" }).click()
  await expect(page.getByRole("button", { name: "Redo" })).toBeEnabled()
  await page.reload()

  await page.getByRole("button", { name: "Battle" }).click()
  await expect(page.getByRole("button", { name: "Redo" })).toBeEnabled()
  await page.getByRole("button", { name: "Redo" }).click()
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled()
  await page.reload()

  const firstRankedValue = page
    .getByRole("listitem")
    .filter({ has: page.getByLabel("Rank 1", { exact: true }) })
  await expect(firstRankedValue).toContainText(firstChoiceName)
  await expect(firstRankedValue).toContainText("Level 3")
  await expect(
    page.getByRole("progressbar", { name: "XP toward Level 4" }),
  ).toHaveAttribute("aria-valuenow", "0")
})

test("a secondary tab stays read-only then inherits released writer ownership", async ({
  context,
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Start" }).click()
  await page.getByRole("button", { name: "Battle" }).click()
  await expect(page.getByRole("main", { name: "Value battle" })).toBeVisible()

  const secondaryPage = await context.newPage()
  await secondaryPage.goto("/")
  await expect(
    secondaryPage.getByRole("heading", { name: "Another Tab Is Active" }),
  ).toBeVisible()
  await expect(
    secondaryPage.getByText(
      "This game was updated in another tab. Reload the latest progress or export this tab’s current state before continuing.",
    ),
  ).toBeVisible()
  await expect(
    secondaryPage.getByRole("button", { name: "Export This Tab" }),
  ).toBeEnabled()
  await expect(
    secondaryPage.getByRole("button", { name: "Start" }),
  ).toHaveCount(0)
  await expect(
    secondaryPage.getByRole("button", { name: "Battle" }),
  ).toHaveCount(0)
  await expect(
    secondaryPage.getByRole("button", { name: /^Choose / }),
  ).toHaveCount(0)

  const ownerChoice = page.getByRole("button", { name: /^Choose / }).first()
  const ownerChoiceName = await getChoiceValueName(ownerChoice)

  await ownerChoice.click()
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled()
  await page.close()

  await secondaryPage.getByRole("button", { name: "Load Latest" }).click()
  await expect(
    secondaryPage.getByRole("heading", { level: 1, name: "Your Values" }),
  ).toBeVisible()
  const inheritedTopValue = secondaryPage
    .getByRole("listitem")
    .filter({ has: secondaryPage.getByLabel("Rank 1", { exact: true }) })
  await expect(inheritedTopValue).toContainText(ownerChoiceName)
  await expect(inheritedTopValue).toContainText("Level 3")

  await secondaryPage.getByRole("button", { name: "Battle" }).click()
  await expect(
    secondaryPage.getByRole("main", { name: "Value battle" }),
  ).toBeVisible()
  const choiceButtons = secondaryPage.getByRole("button", { name: /^Choose / })
  const inheritedPair = await choiceButtons.evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("aria-label")),
  )

  await choiceButtons.first().click()
  await expect
    .poll(() =>
      choiceButtons.evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("aria-label")),
      ),
    )
    .not.toEqual(inheritedPair)
})

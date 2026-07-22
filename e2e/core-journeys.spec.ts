import { expect, test } from "@playwright/test"

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
  await expect(page.getByText("Sovereign Dashboard")).toBeVisible()
  await expect(
    page.getByText("Keep comparing values to reveal your Top Five."),
  ).toBeVisible()

  await page.getByRole("button", { name: "See All Values" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: "All Values" }),
  ).toBeVisible()
  await expect(page.getByText("100 Active Values")).toBeVisible()
  await expect(page.getByRole("listitem")).toHaveCount(100)

  await page.getByRole("searchbox", { name: "Search Values" }).fill("health")
  await expect(page.getByRole("listitem")).toHaveCount(1)
  await expect(page.getByRole("heading", { name: "Health" })).toBeVisible()

  await page.getByRole("button", { name: "Close" }).click()
  await expect(page.getByText("Sovereign Dashboard")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "See All Values" }),
  ).toBeFocused()
})

test("a returning player reads a visible definition and commits one battle", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("wayvm_uuid", "playwright-returning-player")
  })
  await page.goto("/")

  await page.getByRole("button", { name: "Battle" }).click()
  await expect(page.getByRole("main", { name: "Value battle" })).toBeVisible()

  const firstChoice = page.getByRole("button", { name: /^Choose / }).first()
  const firstChoiceName = (
    await firstChoice.getAttribute("aria-label")
  )?.replace(/^Choose /, "")
  if (!firstChoiceName) {
    throw new Error("The first projected value is missing its accessible name")
  }

  await expect(firstChoice).toHaveAccessibleDescription(/^“.+”$/)
  await expect(firstChoice.locator("p")).toBeVisible()
  await expect(page.locator("details")).toHaveCount(0)
  await expect(page.getByRole("button", { name: /^Choose / })).toHaveCount(2)

  await firstChoice.click()
  await expect(page.getByRole("button", { name: "Undo" })).toBeEnabled()
  await page.getByRole("button", { name: /^Stop/ }).click()

  await expect(page.getByText(`#1 ${firstChoiceName}`)).toBeVisible()
  await expect(page.getByText("Level 2")).toBeVisible()
  await expect(
    page.getByRole("progressbar", { name: "XP toward Level 3" }),
  ).toHaveAttribute("aria-valuenow", "0")
})

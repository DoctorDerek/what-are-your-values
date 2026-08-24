import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

async function loadControlledApplication(page: Page) {
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "What Are Your Values, Mapache?" }),
  ).toBeVisible()

  const serviceWorkerIsReady = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false
    await navigator.serviceWorker.ready
    return true
  })
  expect(serviceWorkerIsReady).toBe(true)

  await page.reload({ waitUntil: "networkidle" })
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true)
}

test.beforeEach(() => {
  test.skip(
    !process.env.PLAYWRIGHT_TEST_BASE_URL,
    "Offline registration is intentionally disabled on the development server",
  )
})

test("the production web app installs one isolated application-shell cache", async ({
  page,
}) => {
  await loadControlledApplication(page)

  const cacheNames = await page.evaluate(() => caches.keys())
  expect(cacheNames).toHaveLength(1)
  expect(cacheNames[0]).toContain("serwist-precache")
})

test("the cached production web app reloads while disconnected", async ({
  browserName,
  context,
  page,
}) => {
  test.skip(
    browserName === "webkit",
    "Playwright WebKit cannot automate offline service-worker navigation",
  )

  await loadControlledApplication(page)
  await context.setOffline(true)
  await page.reload({ waitUntil: "domcontentloaded" })
  await expect(
    page.getByRole("heading", { name: "What Are Your Values, Mapache?" }),
  ).toBeVisible()
})

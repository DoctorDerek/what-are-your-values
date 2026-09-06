import { expect, test } from "@playwright/test"
import { installVisibleTextBounds } from "./visible-text-bounds"

test.use({ serviceWorkers: "block" })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installVisibleTextBounds)
})

interface ResponsiveStrikeEvidence {
  identity: string | null
  side: string | null
  originDistance: number
  contactDistance: number
  expectedContactDistance: number
  baselineDifference: number
  inViewport: boolean
  overlapsVisibleText: boolean
  imageIsLoaded: boolean
}

declare global {
  interface Window {
    responsiveStrikes: ResponsiveStrikeEvidence[]
  }
}

for (const width of [390, 1100, 1440]) {
  test(`Hub wheel scrolling works before and after ranking at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    await page.getByRole("button", { name: "Start", exact: true }).click()
    for (const hasComparisons of [false, true]) {
      const rows = page.getByRole("button", { name: /^Open .+ in All Values$/ })
      await expect(rows).toHaveCount(100)
      await rows.first().scrollIntoViewIfNeeded()
      await rows.first().hover()
      const before = await page.evaluate(() => ({
        scrollY,
        height: document.documentElement.scrollHeight,
      }))
      await page.mouse.wheel(0, 500)
      await expect
        .poll(() => page.evaluate(() => scrollY))
        .toBeGreaterThan(before.scrollY + 100)
      const after = await page.evaluate(() => scrollY)
      await page.mouse.wheel(0, -250)
      await expect
        .poll(() => page.evaluate(() => scrollY))
        .toBeLessThan(after - 50)
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight),
      ).toBe(before.height)
      await expect(rows).toHaveCount(100)
      await expect(
        page.getByRole("article", {
          name: "What Are Your Values, Mapache? information",
        }),
      ).toBeAttached()
      if (!hasComparisons) {
        await page.getByRole("button", { name: "Battle", exact: true }).click()
        const stage = page.locator("[data-choreography-identity]")
        const identity = await stage.getAttribute("data-choreography-identity")
        await page
          .getByRole("button", { name: /^Choose / })
          .first()
          .click()
        await expect(stage).not.toHaveAttribute(
          "data-choreography-identity",
          identity!,
        )
        await page.getByRole("button", { name: "Stop", exact: true }).click()
        await expect(
          page.getByRole("heading", { name: "Top Five", exact: true }),
        ).toBeVisible()
      }
    }
  })
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1100, height: 844 },
  { width: 1279, height: 844 },
  { width: 1280, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`both animals make visible contact within two-composition cards at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await page.addInitScript(() => {
      window.responsiveStrikes = []
      document.addEventListener(
        "animationstart",
        (event) => {
          const image = event.target
          if (
            !(image instanceof HTMLImageElement) ||
            image
              .closest("[data-battle-role]")
              ?.getAttribute("data-battle-role") !== "attack"
          )
            return
          const stage = image.closest("[data-choreography-identity]")
          const anchor = image.closest("[data-combatant-side]")
          const traveler = image.closest("[data-combatant-traveler]")
          const side = anchor?.getAttribute("data-combatant-side") ?? null
          const defender = stage?.querySelector(
            `[data-combatant-side="${side === "first" ? "second" : "first"}"]`,
          )
          if (!stage || !anchor || !traveler || !defender) return
          const origin = anchor.getBoundingClientRect()
          const current = traveler.getBoundingClientRect()
          const target = defender.getBoundingClientRect()
          const distance = (bounds: DOMRect) =>
            Math.hypot(
              bounds.x + bounds.width / 2 - target.x - target.width / 2,
              bounds.y + bounds.height / 2 - target.y - target.height / 2,
            )
          window.responsiveStrikes.push({
            identity: stage.getAttribute("data-choreography-identity"),
            side,
            originDistance: distance(origin),
            contactDistance: distance(current),
            expectedContactDistance: (current.width * 3) / 4,
            baselineDifference: Math.abs(current.bottom - target.bottom),
            inViewport: [current, target].every(
              (bounds) =>
                bounds.left >= 0 &&
                bounds.top >= 0 &&
                bounds.right <= innerWidth &&
                bounds.bottom <= innerHeight,
            ),
            imageIsLoaded: image.complete && image.naturalWidth > 0,
            overlapsVisibleText: [...stage.querySelectorAll("h2, p")].some(
              (text) => {
                const { left, right, top, bottom } = window.getVisibleTextBounds(text)
                return (
                  left < right &&
                  top < bottom &&
                  current.left < right &&
                  current.right > left &&
                  current.top < bottom &&
                  current.bottom > top
                )
              },
            ),
          })
        },
        true,
      )
    })
    await page.goto("/")
    await page.getByRole("button", { name: "Start", exact: true }).click()
    await page.getByRole("button", { name: "Battle", exact: true }).click()
    const stage = page.locator("[data-choreography-identity]")
    await expect(stage).toHaveAttribute("data-battle-stage-mode", "licensed")
    const cardGeometry = await stage
      .locator("[data-value-card]")
      .evaluateAll((cards) => {
        const measure = (element: Element) => {
          const { left, right, top, bottom, width } = element.getBoundingClientRect()
          return { left, right, top, bottom, width }
        }
        return cards.map((card) => ({
          card: measure(card),
          reading: measure(card.querySelector('[role="region"]')!),
          animal: measure(card.querySelector("[data-combatant-side]")!),
        }))
      })
    const [first, second] = cardGeometry
    if (!first || !second) throw new Error("Both value cards must be present")
    if (viewport.width < 1280) {
      expect(first.card.bottom).toBeLessThanOrEqual(second.card.top)
      expect(first.reading.bottom).toBeLessThanOrEqual(first.animal.top)
      expect(second.animal.bottom).toBeLessThanOrEqual(second.reading.top)
      expect(first.reading.width).toBe(first.card.width)
      expect(second.reading.width).toBe(second.card.width)
    } else {
      expect(first.card.right).toBeLessThanOrEqual(second.card.left)
      expect(first.reading.bottom).toBeLessThanOrEqual(first.animal.top)
      expect(second.reading.bottom).toBeLessThanOrEqual(second.animal.top)
    }
    for (const side of ["first", "second"] as const) {
      const identity = await stage.getAttribute("data-choreography-identity")
      await expect
        .poll(() =>
          stage
            .locator("img")
            .evaluateAll(
              (images: HTMLImageElement[]) =>
                images.length > 0 &&
                images.every(
                  (image) => image.complete && image.naturalWidth > 0,
                ),
            ),
        )
        .toBe(true)
      await page.keyboard.press(side === "first" ? "1" : "2")
      await expect(stage).not.toHaveAttribute(
        "data-choreography-identity",
        identity!,
      )
      const strikes = await page.evaluate(
        (identity) =>
          window.responsiveStrikes.filter(
            (strike) => strike.identity === identity,
          ),
        identity,
      )
      expect(strikes).toHaveLength(1)
      const strike = strikes[0]!
      expect(strike.side).toBe(side)
      expect(strike.imageIsLoaded).toBe(true)
      expect(strike.inViewport).toBe(true)
      expect(strike.overlapsVisibleText).toBe(false)
      expect(strike.contactDistance).toBeLessThan(strike.originDistance)
      expect(
        Math.abs(strike.contactDistance - strike.expectedContactDistance),
      ).toBeLessThanOrEqual(1)
      expect(strike.baselineDifference).toBeLessThanOrEqual(1)
      await expect(
        page.getByRole("button", { name: /^Choose / }).first(),
      ).toBeEnabled()
    }
  })
}

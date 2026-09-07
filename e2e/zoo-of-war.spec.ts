import { expect, test, type Locator, type Route } from "@playwright/test"
import { installVisibleTextBounds } from "./visible-text-bounds"

test.use({ serviceWorkers: "block" })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(installVisibleTextBounds)
})

test("a delayed attack keeps the loaded animal visible without replacing its images", async ({
  page,
}) => {
  const heldRoutes: Route[] = []
  let releaseAll = false
  await page.route(/\.png(?:\?|$)/, (route) => {
    if (releaseAll) return route.continue()
    heldRoutes.push(route)
  })
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" })
    await page.getByRole("button", { name: "Start", exact: true }).click()
    await page.getByRole("button", { name: "Battle", exact: true }).click()
    const battle = page.getByRole("main", { name: "Value battle" })
    const stage = battle.locator("[data-choreography-identity]")
    await expect(stage).toHaveAttribute("data-battle-stage-mode", "licensed")
    for (const side of ["first", "second"]) {
      const pendingAnimal = battle.locator(`[data-combatant-side="${side}"]`)
      await expect(
        pendingAnimal.locator("[data-placeholder-playback]"),
      ).toBeVisible()
      await expect(pendingAnimal.locator("[data-battle-role]")).toHaveCount(2)
    }
    const identity = await stage.getAttribute("data-choreography-identity")
    const initialImageCount = await battle.locator("img").count()
    await page.keyboard.press("1")
    const sources: string[] = []
    for (const side of ["first", "second"]) {
      const combatant = battle.locator(`[data-combatant-side="${side}"]`)
      await expect(combatant).toHaveAttribute("data-battle-cue", "approach")
      const requestedClip = await combatant
        .locator("[data-battle-requested-clip]")
        .getAttribute("data-battle-requested-clip")
      sources.push(
        await combatant
          .locator(`[data-battle-clip="${requestedClip}"] img`)
          .evaluate((image: HTMLImageElement) => image.src),
      )
    }
    for (const source of new Set(sources)) {
      await expect
        .poll(() =>
          heldRoutes.some((route) => route.request().url() === source),
        )
        .toBe(true)
      const index = heldRoutes.findIndex(
        (route) => route.request().url() === source,
      )
      const [heldRoute] = heldRoutes.splice(index, 1)
      if (!heldRoute)
        throw new Error("Expected the animal image request to remain pending")
      await heldRoute.continue()
    }
    const first = battle.locator('[data-combatant-side="first"]')
    const rest = first.locator("img").filter({ visible: true })
    await expect(rest).toBeVisible()
    const retainedImage = await rest.elementHandle()
    if (!retainedImage)
      throw new Error("Expected the loaded animal image to remain mounted")
    await expect(first).toHaveAttribute("data-battle-cue", "strike")
    await expect(rest).toBeVisible()
    expect(
      await retainedImage.evaluate(
        (image) =>
          image.isConnected && image.complete && image.naturalWidth > 0,
      ),
    ).toBe(true)
    const requestedAttack = await first
      .locator("[data-battle-requested-clip]")
      .getAttribute("data-battle-requested-clip")
    await expect(
      first.locator(`[data-battle-clip="${requestedAttack}"] img`),
    ).not.toBeVisible()
    await expect(battle.locator("img")).toHaveCount(initialImageCount)
    releaseAll = true
    await Promise.all(heldRoutes.splice(0).map((route) => route.continue()))
    await expect
      .poll(() => stage.getAttribute("data-choreography-identity"))
      .not.toBe(identity)
    await expect(stage).toHaveAttribute(
      "data-battle-stage-state",
      "awaiting-input",
    )
  } finally {
    releaseAll = true
    await Promise.all(heldRoutes.splice(0).map((route) => route.continue()))
  }
})

interface CompletedAnimalClip {
  choreographyIdentity: string | null
  side: string | null
  role: string | null
  source: string
  isLoaded: boolean
}

interface AnimalStrikeGeometry {
  choreographyIdentity: string | null
  originDistance: number
  contactDistance: number
  expectedContactDistance: number
  baselineDifference: number
  overlapsText: boolean
}

interface AnimalPaintAudit {
  cachedPlaceholderFrames: number
  imageLayoutChanges: number
  sampledFrames: number
  isRunning: boolean
}

declare global {
  interface Window {
    completedAnimalClips: CompletedAnimalClip[]
    animalStrikes: AnimalStrikeGeometry[]
    animalPaintAudit: AnimalPaintAudit
  }
}

test("cached matchup changes preserve animal pixels without layout-position jumps", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await page.getByRole("button", { name: "Battle", exact: true }).click()
  const battle = page.getByRole("main", { name: "Value battle" })
  const stage = battle.locator("[data-choreography-identity]")
  await expect(stage).toHaveAttribute("data-battle-stage-mode", "licensed")
  const initialIdentity = await stage.getAttribute("data-choreography-identity")
  if (!initialIdentity) throw new Error("Initial battle identity is missing")
  const waitForLoadedImages = async () => {
    await expect
      .poll(() =>
        battle
          .locator("img")
          .evaluateAll(
            (images: HTMLImageElement[]) =>
              images.length > 0 &&
              images.every((image) => image.complete && image.naturalWidth > 0),
          ),
      )
      .toBe(true)
  }
  await waitForLoadedImages()
  await page.evaluate(() => {
    window.animalPaintAudit = {
      cachedPlaceholderFrames: 0,
      imageLayoutChanges: 0,
      sampledFrames: 0,
      isRunning: true,
    }
    const previousImagePositions = new WeakMap<HTMLImageElement, string>()
    const sample = () => {
      if (!window.animalPaintAudit.isRunning) return
      window.animalPaintAudit.sampledFrames += 1
      for (const animal of document.querySelectorAll("[data-combatant-side]")) {
        const images = [...animal.querySelectorAll("img")]
        if (
          images.length > 0 &&
          images.every((image) => image.complete && image.naturalWidth > 0) &&
          animal.querySelector("[data-placeholder-playback]")
        ) {
          window.animalPaintAudit.cachedPlaceholderFrames += 1
        }
        for (const image of images) {
          const left = getComputedStyle(image).left
          const previous = previousImagePositions.get(image)
          if (previous !== undefined && previous !== left)
            window.animalPaintAudit.imageLayoutChanges += 1
          previousImagePositions.set(image, left)
        }
      }
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  try {
    await page.keyboard.press("1")
    await expect
      .poll(() => stage.getAttribute("data-choreography-identity"))
      .not.toBe(initialIdentity)
    await expect(stage).toHaveAttribute(
      "data-battle-stage-state",
      "awaiting-input",
    )
    await waitForLoadedImages()
    const nextIdentity = await stage.getAttribute("data-choreography-identity")
    if (!nextIdentity) throw new Error("Next battle identity is missing")
    for (let replay = 0; replay < 3; replay += 1) {
      await battle.getByRole("button", { name: /^Undo/ }).click()
      await expect(stage).toHaveAttribute(
        "data-choreography-identity",
        initialIdentity,
      )
      await waitForLoadedImages()
      await battle.getByRole("button", { name: /^Redo/ }).click()
      await expect(stage).toHaveAttribute(
        "data-choreography-identity",
        nextIdentity,
      )
      await waitForLoadedImages()
    }
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    const audit = await page.evaluate(() => window.animalPaintAudit)
    expect(audit.sampledFrames).toBeGreaterThan(0)
    expect(audit.cachedPlaceholderFrames).toBe(0)
    expect(audit.imageLayoutChanges).toBe(0)
    for (const side of ["first", "second"]) {
      await expect(
        battle.locator(
          `[data-combatant-side="${side}"] [data-battle-active-clip="true"] img`,
        ),
      ).toBeVisible()
    }
  } finally {
    await page.evaluate(() => {
      window.animalPaintAudit.isRunning = false
    })
  }
})

async function expectRenderedCombatant(
  combatant: Locator,
  mode: string | null,
  shouldReduceMotion: boolean,
) {
  const animatedElement =
    mode === "licensed"
      ? combatant.locator('[data-battle-active-clip="true"] img')
      : combatant.locator("[data-placeholder-playback]")

  await expect(animatedElement).toBeVisible()
  if (mode === "licensed") {
    await expect(animatedElement).toHaveCSS("image-rendering", "pixelated")
    await expect(
      combatant.locator(
        '[data-battle-active-clip="true"] [data-playback-mode]',
      ),
    ).toHaveCSS("overflow", "hidden")
    await expect
      .poll(() =>
        animatedElement.evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
      )
      .toBe(true)
  }

  if (shouldReduceMotion) {
    await expect(animatedElement).toHaveCSS("animation-name", "none")
    return
  }

  await expect(animatedElement).toHaveCSS(
    "animation-iteration-count",
    "infinite",
  )
  await expect
    .poll(() =>
      animatedElement.evaluate((element) =>
        element
          .getAnimations()
          .some((animation) => animation.playState === "running"),
      ),
    )
    .toBe(true)
}

test("the Zoo of War holds both animals through a committed battle", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.completedAnimalClips = []
    window.animalStrikes = []
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
        const defender = stage?.querySelector(
          `[data-combatant-side="${anchor?.getAttribute("data-combatant-side") === "first" ? "second" : "first"}"]`,
        )
        if (!stage || !anchor || !traveler || !defender) return
        const origin = anchor.getBoundingClientRect()
        const current = traveler.getBoundingClientRect()
        const target = defender.getBoundingClientRect()
        const distance = (rectangle: DOMRect) =>
          Math.hypot(
            rectangle.x + rectangle.width / 2 - target.x - target.width / 2,
            rectangle.y + rectangle.height / 2 - target.y - target.height / 2,
          )
        window.animalStrikes.push({
          choreographyIdentity: stage.getAttribute(
            "data-choreography-identity",
          ),
          originDistance: distance(origin),
          contactDistance: distance(current),
          expectedContactDistance: (current.width * 3) / 4,
          baselineDifference: Math.abs(current.bottom - target.bottom),
          overlapsText: [...stage.querySelectorAll("h2, p")].some((text) => {
            const bounds = window.getVisibleTextBounds(text)
            return (
              bounds.left < bounds.right &&
              bounds.top < bounds.bottom &&
              current.left < bounds.right &&
              current.right > bounds.left &&
              current.top < bounds.bottom &&
              current.bottom > bounds.top
            )
          }),
        })
      },
      true,
    )
    document.addEventListener(
      "animationend",
      (event) => {
        const image = event.target
        if (!(image instanceof HTMLImageElement)) return
        const stage = image.closest("[data-choreography-identity]")
        if (!stage) return
        window.completedAnimalClips.push({
          choreographyIdentity: stage.getAttribute(
            "data-choreography-identity",
          ),
          side:
            image
              .closest("[data-combatant-side]")
              ?.getAttribute("data-combatant-side") ?? null,
          role:
            image
              .closest("[data-battle-role]")
              ?.getAttribute("data-battle-role") ?? null,
          source: image.currentSrc,
          isLoaded: image.complete && image.naturalWidth > 0,
        })
      },
      true,
    )
  })
  await page.goto("/")
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await page.getByRole("button", { name: "Battle", exact: true }).click()

  const battle = page.getByRole("main", { name: "Value battle" })
  const stage = battle.locator("[data-battle-stage-state]")
  const firstCombatant = stage.locator('[data-combatant-side="first"]')
  const secondCombatant = stage.locator('[data-combatant-side="second"]')
  const choices = battle.getByRole("button", { name: /^Choose / })

  await expect(battle).toBeVisible()
  await expect(stage).not.toHaveAttribute("aria-hidden", "true")
  const cards = stage.locator("[data-value-card]")
  await expect(cards).toHaveCount(2)
  for (const card of await cards.all()) {
    await expect(card.getByRole("button", { name: /^Choose / })).toBeVisible()
    await expect(card.locator("[data-combatant-side]")).toHaveAttribute(
      "aria-hidden",
      "true",
    )
    await expect(card.locator("[data-combatant-side]")).toHaveAttribute(
      "data-value-id",
      (await card.getAttribute("data-value-card"))!,
    )
  }
  await expect(stage).toHaveAttribute(
    "data-battle-stage-mode",
    /^(licensed|placeholder)$/,
  )
  await expect(firstCombatant).toBeVisible()
  await expect(secondCombatant).toBeVisible()
  await expect(choices).toHaveCount(2)

  const mode = await stage.getAttribute("data-battle-stage-mode")
  await expectRenderedCombatant(firstCombatant, mode, false)
  await expectRenderedCombatant(secondCombatant, mode, false)
  if (mode === "licensed")
    await expect(
      secondCombatant.locator('[data-battle-active-clip="true"] [data-facing]'),
    ).toHaveCSS("scale", "-1 1")

  const initialChoreographyIdentity = await stage.getAttribute(
    "data-choreography-identity",
  )
  if (!initialChoreographyIdentity)
    throw new Error("The initial battle is missing its choreography identity")

  await choices.first().click()
  await expect(stage).toHaveAttribute("data-battle-stage-state", "resolving")

  await expect
    .poll(() => stage.getAttribute("data-choreography-identity"))
    .not.toBe(initialChoreographyIdentity)
  await expect(stage).toHaveAttribute(
    "data-battle-stage-state",
    "awaiting-input",
  )
  await expectRenderedCombatant(firstCombatant, mode, false)
  await expectRenderedCombatant(secondCombatant, mode, false)
  await expect(choices).toHaveCount(2)
  await expect(choices.first()).toBeEnabled()
  await expect(choices.last()).toBeEnabled()

  if (mode === "licensed") {
    const strikes = (await page.evaluate(() => window.animalStrikes)).filter(
      (strike) => strike.choreographyIdentity === initialChoreographyIdentity,
    )
    expect(strikes.length).toBeGreaterThanOrEqual(1)
    for (const strike of strikes) {
      expect(strike.contactDistance).toBeLessThan(strike.originDistance)
      expect(strike.contactDistance).toBeCloseTo(
        strike.expectedContactDistance,
        0,
      )
      expect(strike.baselineDifference).toBeLessThanOrEqual(1)
      expect(strike.overlapsText).toBe(false)
    }
    const completedClips = (
      await page.evaluate(() => window.completedAnimalClips)
    ).filter(
      (clip) => clip.choreographyIdentity === initialChoreographyIdentity,
    )
    expect(
      completedClips.filter(
        (clip) => clip.side === "first" && clip.role === "attack",
      ).length,
    ).toBeGreaterThanOrEqual(1)
    expect(
      completedClips
        .filter((clip) => clip.side === "second" && clip.role === "reaction")
        .map((clip) => clip.role),
    ).toContain("reaction")
    expect(
      completedClips.every((clip) => clip.isLoaded && clip.source.length > 0),
    ).toBe(true)
    expect(
      completedClips.findIndex((clip) => clip.role === "reaction"),
    ).toBeGreaterThan(
      completedClips.findIndex((clip) => clip.role === "attack"),
    )
  }
})

test("introductions do not lock choices and reading panels stop animal motion", async ({
  page,
}) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await page.getByRole("button", { name: "Battle", exact: true }).click()
  const battle = page.getByRole("main", { name: "Value battle" })
  const stage = battle.locator("[data-battle-stage-state]")
  const choices = battle.getByRole("button", { name: /^Choose / })
  const initialIdentity = await stage.getAttribute("data-choreography-identity")
  await expect(choices.last()).toBeEnabled()
  await choices.last().click()
  await expect
    .poll(() => stage.getAttribute("data-choreography-identity"))
    .not.toBe(initialIdentity)

  await page.getByRole("button", { name: "Menu", exact: true }).click()
  const menu = page.getByRole("dialog", { name: "Menu", exact: true })
  await expect(menu).toBeVisible()
  const mode = await stage.getAttribute("data-battle-stage-mode")
  for (const side of ["first", "second"]) {
    await expectRenderedCombatant(
      stage.locator(`[data-combatant-side="${side}"]`),
      mode,
      true,
    )
  }
  await page.keyboard.press("Escape")
  await expect(menu).not.toBeVisible()
  await expect(choices.first()).toBeEnabled()
  await expect(choices.last()).toBeEnabled()
})

for (const { width, height } of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1279, height: 800 },
  { width: 1280, height: 844 },
]) {
  test(`Reduced Motion keeps card-owned animals and readable choices at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/")
    await page.getByRole("button", { name: "Start", exact: true }).click()
    await page.getByRole("button", { name: "Battle", exact: true }).click()

    const battle = page.getByRole("main", { name: "Value battle" })
    const stage = battle.locator("[data-battle-stage-state]")
    const choices = battle.getByRole("button", { name: /^Choose / })
    const mode = await stage.getAttribute("data-battle-stage-mode")

    await expectRenderedCombatant(
      stage.locator('[data-combatant-side="first"]'),
      mode,
      true,
    )
    await expectRenderedCombatant(
      stage.locator('[data-combatant-side="second"]'),
      mode,
      true,
    )
    await expect(choices).toHaveCount(2)
    await expect(choices.first()).toBeInViewport()
    await expect(choices.last()).toBeInViewport()
    for (const card of await stage.locator("[data-value-card]").all()) {
      const choice = card.getByRole("button", { name: /^Choose / })
      await expect(choice.getByRole("heading")).toBeInViewport()
      const readingRegion = card.getByRole("region")
      const needsReadingScroll = await readingRegion.evaluate(
        (region) => region.scrollHeight > region.clientHeight,
      )
      if (needsReadingScroll) {
        await readingRegion.focus()
        await page.keyboard.press("End")
      }
      await expect(choice.locator("p")).toBeInViewport()
      if (needsReadingScroll) await page.keyboard.press("Home")
      const animal = card.locator("[data-combatant-side]")
      await expect(animal).toBeInViewport()
      const textDoesNotOverlapAnimal = await card.evaluate((card) => {
        const animal = card
          .querySelector("[data-combatant-side]")!
          .getBoundingClientRect()
        return [...card.querySelectorAll("h2, p")].every((text) => {
          const bounds = window.getVisibleTextBounds(text)
          return (
            bounds.left >= bounds.right ||
            bounds.top >= bounds.bottom ||
            bounds.right <= animal.left ||
            bounds.left >= animal.right ||
            bounds.bottom <= animal.top ||
            bounds.top >= animal.bottom
          )
        })
      })
      expect(textDoesNotOverlapAnimal).toBe(true)
    }
    await expect(
      page.getByRole("button", { name: "Menu", exact: true }),
    ).toBeInViewport()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)

    const initialChoiceNames = await choices.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    )
    await choices.last().click()
    await expect
      .poll(() =>
        choices.evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute("aria-label")),
        ),
      )
      .not.toEqual(initialChoiceNames)
    await expect(choices.first()).toBeEnabled()
    await expect(choices.last()).toBeEnabled()
  })
}

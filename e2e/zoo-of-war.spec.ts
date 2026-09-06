import { expect, test, type Locator, type Route } from "@playwright/test"

test.use({ serviceWorkers: "block" })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.getVisibleTextBounds = (text) => {
      const bounds = text.getBoundingClientRect()
      let { left, right, top, bottom } = bounds
      for (
        let ancestor = text.parentElement;
        ancestor;
        ancestor = ancestor.parentElement
      ) {
        const style = getComputedStyle(ancestor)
        const clip = ancestor.getBoundingClientRect()
        if (["auto", "scroll", "hidden", "clip"].includes(style.overflowX)) {
          left = Math.max(left, clip.left)
          right = Math.min(right, clip.right)
        }
        if (["auto", "scroll", "hidden", "clip"].includes(style.overflowY)) {
          top = Math.max(top, clip.top)
          bottom = Math.min(bottom, clip.bottom)
        }
      }
      return { left, right, top, bottom }
    }
  })
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
    const restImages = battle.locator('[data-battle-clip="rest"] img')
    const sources = await restImages.evaluateAll((images: HTMLImageElement[]) =>
      images.map((image) => image.src),
    )
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
    const rest = first.locator('[data-battle-clip="rest"] img')
    await expect(rest).toBeVisible()
    const retainedImage = await rest.elementHandle()
    if (!retainedImage)
      throw new Error("Expected the loaded animal image to remain mounted")
    await page.keyboard.press("1")
    await expect(first).toHaveAttribute("data-battle-cue", "strike")
    await expect(rest).toBeVisible()
    expect(
      await retainedImage.evaluate(
        (image) =>
          image.isConnected && image.complete && image.naturalWidth > 0,
      ),
    ).toBe(true)
    await expect(
      first.locator('[data-battle-clip="attack"] img'),
    ).not.toBeVisible()
    await expect(battle.locator("img")).toHaveCount(12)
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

declare global {
  interface Window {
    getVisibleTextBounds: (
      text: Element,
    ) => Pick<DOMRect, "left" | "right" | "top" | "bottom">
    completedAnimalClips: CompletedAnimalClip[]
    animalStrikes: AnimalStrikeGeometry[]
  }
}

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
    await expect(card.locator("[data-combatant-side]")).toHaveAttribute("aria-hidden", "true")
    await expect(card.locator("[data-combatant-side]")).toHaveAttribute("data-value-id", (await card.getAttribute("data-value-card"))!)
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
    expect(strikes).toHaveLength(1)
    expect(strikes[0]!.contactDistance).toBeLessThan(strikes[0]!.originDistance)
    expect(strikes[0]!.contactDistance).toBeCloseTo(
      strikes[0]!.expectedContactDistance,
      0,
    )
    expect(strikes[0]!.baselineDifference).toBeLessThanOrEqual(1)
    expect(strikes[0]!.overlapsText).toBe(false)
    const completedClips = (
      await page.evaluate(() => window.completedAnimalClips)
    ).filter(
      (clip) => clip.choreographyIdentity === initialChoreographyIdentity,
    )
    expect(
      completedClips
        .filter(
          (clip) =>
            clip.side === "first" &&
            ["attack", "flourish"].includes(clip.role ?? ""),
        )
        .map((clip) => clip.role),
    ).toEqual(["attack", "flourish"])
    expect(
      completedClips
        .filter((clip) => clip.side === "second" && clip.role === "reaction")
        .map((clip) => clip.role),
    ).toEqual(["reaction"])
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
      await expect(choice.locator("p")).toBeInViewport()
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

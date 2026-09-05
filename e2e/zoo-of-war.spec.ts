import { expect, test, type Locator } from "@playwright/test"

async function expectRenderedCombatant(
  combatant: Locator,
  mode: string | null,
  shouldReduceMotion: boolean,
) {
  const animatedElement =
    mode === "licensed"
      ? combatant.locator("img")
      : combatant.locator("[data-placeholder-playback]")

  await expect(animatedElement).toBeVisible()
  if (mode === "licensed") {
    await expect(animatedElement).toHaveCSS("image-rendering", "pixelated")
    await expect(combatant.locator("[data-playback-mode]")).toHaveCSS(
      "overflow",
      "hidden",
    )
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
  await page.goto("/")
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await page.getByRole("button", { name: "Battle", exact: true }).click()

  const battle = page.getByRole("main", { name: "Value battle" })
  const stage = battle.locator("[data-battle-stage-state]")
  const firstCombatant = stage.locator('[data-combatant-side="first"]')
  const secondCombatant = stage.locator('[data-combatant-side="second"]')
  const choices = battle.getByRole("button", { name: /^Choose / })

  await expect(battle).toBeVisible()
  await expect(stage).toHaveAttribute("aria-hidden", "true")
  await expect(stage).toHaveAttribute(
    "data-battle-stage-mode",
    /^(licensed|placeholder)$/,
  )
  await expect(firstCombatant).toBeVisible()
  await expect(secondCombatant).toBeVisible()
  await expect(firstCombatant).toHaveAttribute("data-battle-role", "rest")
  await expect(secondCombatant).toHaveAttribute("data-battle-role", "rest")
  await expect(choices).toHaveCount(2)

  const mode = await stage.getAttribute("data-battle-stage-mode")
  await expectRenderedCombatant(firstCombatant, mode, false)
  await expectRenderedCombatant(secondCombatant, mode, false)
  if (mode === "licensed")
    await expect(secondCombatant.locator("[data-facing]")).toHaveCSS(
      "scale",
      "-1 1",
    )

  const initialChoreographyIdentity = await stage.getAttribute(
    "data-choreography-identity",
  )
  if (!initialChoreographyIdentity)
    throw new Error("The initial battle is missing its choreography identity")

  await choices.first().click()
  await expect(stage).toHaveAttribute("data-battle-stage-state", "resolving")
  await expect(firstCombatant).toHaveAttribute("data-battle-role", "attack")
  await expect(secondCombatant).toHaveAttribute("data-battle-role", "reaction")

  await expect
    .poll(() => stage.getAttribute("data-choreography-identity"))
    .not.toBe(initialChoreographyIdentity)
  await expect(stage).toHaveAttribute(
    "data-battle-stage-state",
    "awaiting-input",
  )
  await expect(firstCombatant).toHaveAttribute("data-battle-role", "rest")
  await expect(secondCombatant).toHaveAttribute("data-battle-role", "rest")
  await expect(choices).toHaveCount(2)
  await expect(choices.first()).toBeEnabled()
  await expect(choices.last()).toBeEnabled()
})

for (const width of [390, 1280]) {
  test(`Reduced Motion keeps the animal battle playable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
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

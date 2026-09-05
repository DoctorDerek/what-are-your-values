import { expect, test } from "@playwright/test"

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

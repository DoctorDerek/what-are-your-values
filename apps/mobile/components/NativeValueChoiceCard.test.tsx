import { CANONICAL_VALUES } from "@game/data/src/CanonicalValues"
import { CUSTOM_VALUE_NAME_MAX_GRAPHEMES } from "@game/data/src/CustomValueValidation"
import {
  createCustomValueId,
  getValueDisplayDefinition,
  getValueDisplayName,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import { getValueChoiceAccessibilityLabel } from "@game/machines/src/BattleAccessibilityPresentation"
import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import type { ComponentProps } from "react"
import NativeValueChoiceCard from "@/components/NativeValueChoiceCard"

const selfAcceptance = CANONICAL_VALUES.find(
  ({ englishName }) => englishName === "Self-Acceptance",
)

if (!selfAcceptance)
  throw new Error("Self-Acceptance is missing from the canonical catalog")

const maximumWidthCustomValueName = "W".repeat(CUSTOM_VALUE_NAME_MAX_GRAPHEMES)
const maximumWidthCustomValue = Object.freeze({
  kind: "custom",
  id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
  name: maximumWidthCustomValueName,
  definition: "A deliberately wide name at the supported Custom Value limit.",
  creationOrdinal: 1,
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
}) satisfies CustomValueDefinition

describe("NativeValueChoiceCard", () => {
  it("preserves complete canonical and maximum-length Custom Value names", async () => {
    const user = userEvent.setup()
    const cases = Object.freeze([
      {
        position: "first",
        value: selfAcceptance,
        level: 4,
        controlHint: "Tap",
      },
      {
        position: "second",
        value: maximumWidthCustomValue,
        level: 37,
        controlHint: "B",
      },
    ] as const)

    for (const choiceCase of cases) {
      const onActivate = jest.fn()
      const props = {
        ...choiceCase,
        winnerId: null,
        isEnabled: true,
        isAnimating: false,
        reportsAnimationCompletion: false,
        shouldReduceMotion: true,
        onActivate,
        onAnimationComplete: jest.fn(),
      } satisfies ComponentProps<typeof NativeValueChoiceCard>
      const { unmount } = await render(<NativeValueChoiceCard {...props} />)
      const displayName = getValueDisplayName(choiceCase.value)
      const name = screen.getByText(displayName)
      const choice = screen.getByRole("button", {
        name: getValueChoiceAccessibilityLabel(choiceCase),
      })

      expect(name).toHaveProp("lineBreakStrategyIOS", "push-out")
      expect(name).toHaveProp("textBreakStrategy", "balanced")
      expect(name.props.numberOfLines).toBeUndefined()
      expect(name.props.ellipsizeMode).toBeUndefined()
      expect(choice).toHaveProp(
        "accessibilityHint",
        getValueDisplayDefinition(choiceCase.value),
      )

      await user.press(choice)
      expect(onActivate).toHaveBeenCalledTimes(1)
      expect(onActivate).toHaveBeenCalledWith(choiceCase.value.id)

      await unmount()
    }
  })
})

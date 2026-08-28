import { createActiveDeck } from "@game/data/src/ActiveDeck"
import { CUSTOM_VALUE_STARTER_EXAMPLES } from "@game/data/src/CustomValueStarterExamples"
import { customValueValidationMessages } from "@game/data/src/CustomValueValidationMessages"
import {
  createCustomValueId,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import { createInitialValueProgress } from "@game/data/src/ValueProgress"
import { rankValues } from "@game/data/src/ValueRanking"
import { describe, expect, it, jest } from "@jest/globals"
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from "@testing-library/react-native"
import NativeCustomValueForm from "@/components/NativeCustomValueForm"

const ingenuity = Object.freeze({
  kind: "custom",
  id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
  name: "Ingenuity",
  definition: "Ability to solve problems creatively.",
  creationOrdinal: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}) satisfies CustomValueDefinition

function createRankedValues(customValues: readonly CustomValueDefinition[]) {
  const activeDeck = createActiveDeck(customValues)
  return rankValues(activeDeck, createInitialValueProgress(activeDeck))
}

function createCallbacks() {
  return {
    onCancel: jest.fn(),
    onOpenMatchingValue: jest.fn(),
    onSubmit: jest.fn(),
  }
}

function createAddProps() {
  return {
    ...createCallbacks(),
    existingCustomValues: [] as readonly CustomValueDefinition[],
    isPersistencePending: false,
    mode: "add" as const,
    rankedValues: createRankedValues([]),
  }
}

describe("NativeCustomValueForm", () => {
  it("loads a starter example as an editable unsaved draft", async () => {
    const props = createAddProps()
    const user = userEvent.setup()
    const starter = CUSTOM_VALUE_STARTER_EXAMPLES[0]
    await render(<NativeCustomValueForm {...props} />)

    await user.press(
      screen.getByRole("button", {
        name: new RegExp(`^\\+ Start with ${starter.name}`),
      }),
    )

    expect(screen.getByLabelText("Value Name")).toHaveDisplayValue(starter.name)
    expect(
      screen.getByLabelText("What This Value Means to Me"),
    ).toHaveDisplayValue(starter.definition)

    await user.press(screen.getByRole("button", { name: "Save Value" }))

    expect(props.onSubmit).toHaveBeenCalledWith(
      starter.name,
      starter.definition,
    )
  })

  it("reveals required-field guidance only after each field is touched", async () => {
    const props = createAddProps()
    await render(<NativeCustomValueForm {...props} />)

    expect(
      screen.queryByText(customValueValidationMessages.name.required),
    ).not.toBeOnTheScreen()
    expect(
      screen.queryByText(customValueValidationMessages.definition.required),
    ).not.toBeOnTheScreen()

    await fireEvent(screen.getByLabelText("Value Name"), "blur")
    await fireEvent(
      screen.getByLabelText("What This Value Means to Me"),
      "blur",
    )

    expect(
      screen.getByText(customValueValidationMessages.name.required),
    ).toHaveProp("accessibilityRole", "alert")
    expect(
      screen.getByText(customValueValidationMessages.definition.required),
    ).toHaveProp("accessibilityRole", "alert")
    expect(screen.getByRole("button", { name: "Save Value" })).toBeDisabled()
  })

  it("opens exact canonical collisions instead of saving duplicates", async () => {
    const props = createAddProps()
    const user = userEvent.setup()
    await render(<NativeCustomValueForm {...props} />)

    await user.type(screen.getByLabelText("Value Name"), "Health")
    await user.type(
      screen.getByLabelText("What This Value Means to Me"),
      "My personal definition.",
    )

    expect(
      screen.getByText(customValueValidationMessages.name.duplicate_name),
    ).toHaveProp("accessibilityRole", "alert")
    const openHealth = screen.getByRole("button", { name: "Open Health" })
    await user.press(openHealth)

    expect(props.onOpenMatchingValue).toHaveBeenCalledWith(
      createRankedValues([]).find(
        ({ definition }) =>
          definition.kind === "canonical" &&
          definition.englishName === "Health",
      )?.definition.id,
    )
    expect(screen.getByRole("button", { name: "Save Value" })).toBeDisabled()
  })

  it("offers partial name matches as suggestions without blocking a valid draft", async () => {
    const props = createAddProps()
    const user = userEvent.setup()
    await render(<NativeCustomValueForm {...props} />)

    await user.type(screen.getByLabelText("Value Name"), "Heal")
    await user.type(
      screen.getByLabelText("What This Value Means to Me"),
      "To repair what has been hurt.",
    )

    expect(screen.getByText("Matching values")).toBeOnTheScreen()
    expect(screen.getByRole("button", { name: "Open Health" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Save Value" })).toBeEnabled()
  })

  it("requires review before preserving progress through an edited value", async () => {
    const callbacks = createCallbacks()
    const user = userEvent.setup()
    await render(
      <NativeCustomValueForm
        {...callbacks}
        existingCustomValues={[ingenuity]}
        excludedCustomValueId={ingenuity.id}
        initialDefinition={ingenuity.definition}
        initialName={ingenuity.name}
        isPersistencePending={false}
        mode="edit"
        rankedValues={createRankedValues([ingenuity])}
      />,
    )

    const reviewUpdate = screen.getByRole("button", { name: "Review Update" })
    expect(reviewUpdate).toBeDisabled()

    const definition = screen.getByLabelText("What This Value Means to Me")
    await user.clear(definition)
    await user.type(definition, "Resourceful original problem solving.")
    await user.press(reviewUpdate)

    expect(screen.getByText(/Earlier comparisons remain/)).toBeOnTheScreen()
    await user.press(screen.getByRole("button", { name: "Cancel" }))
    expect(
      screen.queryByText(/Earlier comparisons remain/),
    ).not.toBeOnTheScreen()

    await user.press(screen.getByRole("button", { name: "Review Update" }))
    await user.press(screen.getByRole("button", { name: "Update Value" }))

    expect(callbacks.onSubmit).toHaveBeenCalledWith(
      ingenuity.name,
      "Resourceful original problem solving.",
    )
  })

  it("withdraws edit confirmation when the reviewed draft changes", async () => {
    const callbacks = createCallbacks()
    const user = userEvent.setup()
    await render(
      <NativeCustomValueForm
        {...callbacks}
        existingCustomValues={[ingenuity]}
        excludedCustomValueId={ingenuity.id}
        initialDefinition={ingenuity.definition}
        initialName={ingenuity.name}
        isPersistencePending={false}
        mode="edit"
        rankedValues={createRankedValues([ingenuity])}
      />,
    )

    const name = screen.getByLabelText("Value Name")
    await user.type(name, " Plus")
    await user.press(screen.getByRole("button", { name: "Review Update" }))
    expect(screen.getByText(/Earlier comparisons remain/)).toBeOnTheScreen()

    await user.type(name, " More")

    expect(
      screen.queryByText(/Earlier comparisons remain/),
    ).not.toBeOnTheScreen()
    expect(callbacks.onSubmit).not.toHaveBeenCalled()
  })

  it("locks every editable action while persistence is pending", async () => {
    const props = createAddProps()
    await render(<NativeCustomValueForm {...props} isPersistencePending />)

    expect(screen.getByLabelText("Value Name")).toHaveProp("editable", false)
    expect(screen.getByLabelText("What This Value Means to Me")).toHaveProp(
      "editable",
      false,
    )
    for (const button of screen.getAllByRole("button"))
      expect(button).toBeDisabled()
  })
})

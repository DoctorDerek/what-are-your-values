import { createActiveDeck, type ActiveDeck } from "@game/data/src/ActiveDeck"
import { CANONICAL_VALUES } from "@game/data/src/CanonicalValues"
import {
  createCustomValueId,
  getValueDisplayDefinition,
  getValueDisplayName,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import { createInitialValueProgress } from "@game/data/src/ValueProgress"
import { rankValues } from "@game/data/src/ValueRanking"
import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"
import AllValues from "./AllValues"

function createRankedValues(activeDeck: ActiveDeck) {
  return rankValues(activeDeck, createInitialValueProgress(activeDeck))
}

function createActiveDeckWithIngenuity() {
  return createActiveDeck([
    Object.freeze({
      kind: "custom",
      id: createCustomValueId("custom:00000000-0000-4000-8000-000000000001"),
      name: "Ingenuity",
      definition: "Ability to solve problems creatively.",
      creationOrdinal: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }) satisfies CustomValueDefinition,
  ])
}

function renderAllValues(
  rankedValues = createRankedValues(createActiveDeck([])),
  overrides: Partial<ComponentProps<typeof AllValues>> = {},
) {
  return render(
    <AllValues
      rankedValues={rankedValues}
      onClose={vi.fn()}
      onAddCustomValue={vi.fn()}
      onUpdateCustomValue={vi.fn()}
      onDeleteCustomValue={vi.fn()}
      {...overrides}
    />,
  )
}

describe("All Values Component Integration", () => {
  it("shows every fresh value alphabetically with definitions visible and no fabricated Top Five", () => {
    const rankedValues = createRankedValues(createActiveDeck([]))

    renderAllValues(rankedValues)

    expect(
      screen.getByRole("heading", { name: "All Values", level: 1 }),
    ).toBeVisible()
    expect(
      screen.getByText(`${CANONICAL_VALUES.length} Active Values`),
    ).toBeVisible()
    expect(screen.getAllByRole("listitem")).toHaveLength(
      CANONICAL_VALUES.length,
    )
    expect(screen.queryByText("Top Five")).not.toBeInTheDocument()
    expect(
      screen.getByText(
        `“${getValueDisplayDefinition(rankedValues[0].definition)}”`,
      ),
    ).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Show definition" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument()
  })

  it("prefills each canonical starter example as an unsaved editable draft", () => {
    renderAllValues()

    fireEvent.click(
      screen.getByRole("button", { name: /Start with Ingenuity/ }),
    )

    expect(screen.getByRole("form", { name: "Add Custom Value" })).toBeVisible()
    expect(screen.getByLabelText("Value Name")).toHaveValue("Ingenuity")
    expect(screen.getByLabelText("What This Value Means to Me")).toHaveValue(
      "To solve problems in original, resourceful, and practical ways.",
    )
    expect(screen.getByRole("button", { name: "Save Value" })).toBeEnabled()
    expect(
      screen.getByRole("button", { name: /Mapachito’s example/ }),
    ).toBeVisible()
  })

  it("opens and closes the builder when Hub requests the custom-value action", () => {
    renderAllValues(undefined, { openCustomValueBuilder: true })

    expect(screen.getByRole("form", { name: "Add Custom Value" })).toBeVisible()
    fireEvent.click(
      screen.getByRole("button", { name: "Close Custom Value Form" }),
    )
    expect(
      screen.queryByRole("form", { name: "Add Custom Value" }),
    ).not.toBeInTheDocument()
  })

  it("adds a custom value with the private definition payload", () => {
    const onAddCustomValue = vi.fn()

    renderAllValues(undefined, { onAddCustomValue })

    fireEvent.click(screen.getByRole("button", { name: "Add Custom Value" }))
    fireEvent.change(screen.getByLabelText("Value Name"), {
      target: { value: "   Ingenuity   " },
    })
    fireEvent.change(screen.getByLabelText("What This Value Means to Me"), {
      target: { value: "  Inventions and original ideas matter. " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save Value" }))

    expect(onAddCustomValue).toHaveBeenCalledWith(
      "Ingenuity",
      "Inventions and original ideas matter.",
    )
    expect(screen.getByRole("form", { name: "Add Custom Value" })).toBeVisible()
    expect(screen.getByLabelText("Value Name")).toHaveValue(
      "   Ingenuity   ",
    )
    expect(screen.getByLabelText("What This Value Means to Me")).toHaveValue(
      "  Inventions and original ideas matter. ",
    )
  })

  it("locks navigation and mutation controls while persistence is pending", () => {
    renderAllValues(undefined, {
      openCustomValueBuilder: true,
      isPersistencePending: true,
    })

    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Close Custom Value Form" }),
    ).toBeDisabled()
    expect(screen.getByLabelText("Value Name")).toBeDisabled()
    expect(screen.getByLabelText("What This Value Means to Me")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled()
    expect(
      screen.getByRole("button", { name: /Start with Ingenuity/ }),
    ).toBeDisabled()
  })

  it("keeps an incomplete add draft open without submitting it", () => {
    const onAddCustomValue = vi.fn()

    renderAllValues(undefined, { onAddCustomValue })

    fireEvent.click(screen.getByRole("button", { name: "Add Custom Value" }))
    fireEvent.submit(screen.getByRole("form", { name: "Add Custom Value" }))

    expect(onAddCustomValue).not.toHaveBeenCalled()
    expect(screen.getByRole("form", { name: "Add Custom Value" })).toBeVisible()
  })

  it("explains required fields after interaction and counts grapheme clusters", () => {
    renderAllValues()

    fireEvent.click(screen.getByRole("button", { name: "Add Custom Value" }))
    const nameInput = screen.getByLabelText("Value Name")
    const definitionInput = screen.getByLabelText("What This Value Means to Me")

    expect(screen.getByText("0 / 60 characters")).toBeVisible()
    expect(screen.getByText("0 / 280 characters")).toBeVisible()
    expect(
      screen.queryByText("Enter a name for this value."),
    ).not.toBeInTheDocument()

    fireEvent.blur(nameInput)
    fireEvent.blur(definitionInput)

    expect(screen.getByText("Enter a name for this value.")).toBeVisible()
    expect(
      screen.getByText("Enter a short personal definition for this value."),
    ).toBeVisible()
    expect(nameInput).toHaveAttribute("aria-invalid", "true")
    expect(definitionInput).toHaveAttribute("aria-invalid", "true")

    fireEvent.change(nameInput, { target: { value: "👨‍👩‍👧‍👦" } })
    fireEvent.change(definitionInput, {
      target: { value: "Caring for family with intention." },
    })

    expect(screen.getByText("1 / 60 characters")).toBeVisible()
    expect(screen.getByRole("button", { name: "Save Value" })).toBeEnabled()
  })

  it("keeps overlong or controlled Custom Value drafts visible and unsaved", () => {
    const onAddCustomValue = vi.fn()

    renderAllValues(undefined, { onAddCustomValue })

    fireEvent.click(screen.getByRole("button", { name: "Add Custom Value" }))
    const nameInput = screen.getByLabelText("Value Name")
    const definitionInput = screen.getByLabelText("What This Value Means to Me")
    fireEvent.change(nameInput, { target: { value: "🦝".repeat(61) } })
    fireEvent.change(definitionInput, {
      target: { value: "Purpose\u202e" },
    })
    fireEvent.blur(nameInput)
    fireEvent.blur(definitionInput)

    expect(
      screen.getByText("Use 60 or fewer characters for the value name."),
    ).toBeVisible()
    expect(
      screen.getByText(
        "Remove invisible or control characters from the personal definition.",
      ),
    ).toBeVisible()
    expect(screen.getByText("61 / 60 characters")).toBeVisible()
    expect(screen.getByRole("button", { name: "Save Value" })).toBeDisabled()
    expect(onAddCustomValue).not.toHaveBeenCalled()
    expect(nameInput).toHaveValue("🦝".repeat(61))
    expect(definitionInput).toHaveValue("Purpose\u202e")
  })

  it("cancels an unsaved custom value draft", () => {
    renderAllValues()

    fireEvent.click(screen.getByRole("button", { name: "Add Custom Value" }))
    fireEvent.change(screen.getByLabelText("Value Name"), {
      target: { value: "Ingenuity" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(
      screen.queryByRole("form", { name: "Add Custom Value" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Ingenuity")).not.toBeInTheDocument()
  })

  it("shows exact collisions with an open-existing-value path", () => {
    const rankedValues = createRankedValues(createActiveDeckWithIngenuity())
    const onAddCustomValue = vi.fn()

    renderAllValues(rankedValues, { onAddCustomValue })

    fireEvent.click(screen.getByRole("button", { name: "Add Custom Value" }))
    fireEvent.change(screen.getByLabelText("Value Name"), {
      target: { value: "  INGENUITY  " },
    })
    fireEvent.change(screen.getByLabelText("What This Value Means to Me"), {
      target: { value: "Another form of creativity." },
    })

    expect(
      screen.getByText("This value already exists. Open it instead."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Save Value" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Open Ingenuity" })).toBeVisible()
    expect(onAddCustomValue).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Open Ingenuity" }))
    expect(
      screen.queryByRole("form", { name: "Add Custom Value" }),
    ).not.toBeInTheDocument()
    const openedValueRow = screen.getByText("Ingenuity").closest("li")
    if (!openedValueRow) {
      throw new Error("Expected the existing value row to remain open")
    }
    expect(openedValueRow).toHaveClass("ring-8")
  })

  it("shows partial literal matches without semantic or synonym inference", () => {
    const rankedValues = createRankedValues(createActiveDeckWithIngenuity())

    renderAllValues(rankedValues)

    fireEvent.click(screen.getByRole("button", { name: "Add Custom Value" }))
    fireEvent.change(screen.getByLabelText("Value Name"), {
      target: { value: "ingen" },
    })

    expect(screen.getByText("Matching values")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open Ingenuity" })).toBeVisible()
    expect(
      screen.queryByText("This value already exists. Open it instead."),
    ).not.toBeInTheDocument()
  })

  it("edits a Custom Value only after an explicit review step", () => {
    const activeDeck = createActiveDeckWithIngenuity()
    const onUpdateCustomValue = vi.fn()

    renderAllValues(createRankedValues(activeDeck), { onUpdateCustomValue })

    const targetListItem = screen.getByText("Ingenuity").closest("li")
    if (!targetListItem) {
      throw new Error("Expected Ingenuity list item in DOM")
    }
    fireEvent.click(
      within(targetListItem).getByRole("button", { name: "Edit" }),
    )
    fireEvent.change(screen.getByLabelText("Value Name"), {
      target: { value: " Curiosity Engine " },
    })
    fireEvent.change(screen.getByLabelText("What This Value Means to Me"), {
      target: { value: "  A drive to explore how things connect. " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Review Update" }))

    expect(
      screen.getByRole("alertdialog", { name: "Update Ingenuity?" }),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Update Value" })).toHaveClass(
      "text-black",
    )
    expect(onUpdateCustomValue).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Update Value" }))
    expect(onUpdateCustomValue).toHaveBeenCalledWith(
      activeDeck.customValues[0].id,
      "Curiosity Engine",
      "A drive to explore how things connect.",
    )
  })

  it("allows cancelling the explicit Custom Value update review", () => {
    const activeDeck = createActiveDeckWithIngenuity()
    const onUpdateCustomValue = vi.fn()

    renderAllValues(createRankedValues(activeDeck), { onUpdateCustomValue })

    const targetListItem = screen.getByText("Ingenuity").closest("li")
    if (!targetListItem) {
      throw new Error("Expected Ingenuity list item in DOM")
    }
    fireEvent.click(
      within(targetListItem).getByRole("button", { name: "Edit" }),
    )
    fireEvent.change(screen.getByLabelText("Value Name"), {
      target: { value: "Curiosity Engine" },
    })
    fireEvent.change(screen.getByLabelText("What This Value Means to Me"), {
      target: { value: "A drive to explore how things connect." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Review Update" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(
      screen.queryByRole("alertdialog", { name: "Update Ingenuity?" }),
    ).not.toBeInTheDocument()
    expect(onUpdateCustomValue).not.toHaveBeenCalled()
  })

  it("keeps an invalid Custom Value update local and unconfirmed", () => {
    const activeDeck = createActiveDeckWithIngenuity()
    const onUpdateCustomValue = vi.fn()

    renderAllValues(createRankedValues(activeDeck), { onUpdateCustomValue })

    const targetListItem = screen.getByText("Ingenuity").closest("li")
    if (!targetListItem) {
      throw new Error("Expected Ingenuity list item in DOM")
    }
    fireEvent.click(
      within(targetListItem).getByRole("button", { name: "Edit" }),
    )
    fireEvent.change(screen.getByLabelText("Value Name"), {
      target: { value: "" },
    })
    fireEvent.change(screen.getByLabelText("What This Value Means to Me"), {
      target: { value: "" },
    })
    const editForm = targetListItem.querySelector("form")
    if (!editForm) {
      throw new Error("Expected Custom Value edit form in DOM")
    }
    fireEvent.submit(editForm)

    fireEvent.change(screen.getByLabelText("Value Name"), {
      target: { value: "Curiosity Engine" },
    })
    fireEvent.change(screen.getByLabelText("What This Value Means to Me"), {
      target: { value: "A drive to explore how things connect." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Review Update" }))
    fireEvent.change(screen.getByLabelText("Value Name"), {
      target: { value: "" },
    })
    fireEvent.change(screen.getByLabelText("What This Value Means to Me"), {
      target: { value: "" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Update Value" }))

    expect(
      screen.getByRole("alertdialog", { name: "Update Ingenuity?" }),
    ).toBeVisible()
    expect(onUpdateCustomValue).not.toHaveBeenCalled()
  })

  it("confirms Custom Value deletion through the supplied durable callback", () => {
    const activeDeck = createActiveDeckWithIngenuity()
    const onDeleteCustomValue = vi.fn()

    renderAllValues(createRankedValues(activeDeck), { onDeleteCustomValue })

    const targetListItem = screen.getByText("Ingenuity").closest("li")
    if (!targetListItem) {
      throw new Error("Expected Ingenuity list item in DOM")
    }
    const deleteButton = within(targetListItem).getByRole("button", {
      name: "Delete",
    })
    expect(deleteButton).toHaveClass("text-black")
    fireEvent.click(deleteButton)
    expect(
      screen.getByRole("alertdialog", { name: "Remove Ingenuity?" }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(
      screen.queryByRole("alertdialog", { name: "Remove Ingenuity?" }),
    ).not.toBeInTheDocument()
    fireEvent.click(
      within(targetListItem).getByRole("button", { name: "Delete" }),
    )
    const deleteValueButton = screen.getByRole("button", {
      name: "Delete Value",
    })
    expect(deleteValueButton).toHaveClass("text-black")
    fireEvent.click(deleteValueButton)

    expect(onDeleteCustomValue).toHaveBeenCalledWith(
      activeDeck.customValues[0].id,
    )
  })

  it("disables editing into an existing value name", () => {
    const firstCustom = createActiveDeckWithIngenuity().customValues[0]
    const secondCustom = Object.freeze({
      kind: "custom",
      id: createCustomValueId("custom:00000000-0000-4000-8000-000000000002"),
      name: "Curiosity Engine",
      definition: "A drive to explore how things connect.",
      creationOrdinal: 2,
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    }) satisfies CustomValueDefinition
    const activeDeck = createActiveDeck([firstCustom, secondCustom])

    renderAllValues(createRankedValues(activeDeck))

    const targetListItem = screen.getByText("Ingenuity").closest("li")
    if (!targetListItem) {
      throw new Error("Expected Ingenuity list item in DOM")
    }
    fireEvent.click(
      within(targetListItem).getByRole("button", { name: "Edit" }),
    )
    fireEvent.change(screen.getByLabelText("Value Name"), {
      target: { value: "Curiosity Engine" },
    })
    fireEvent.blur(screen.getByLabelText("Value Name"))
    expect(
      screen.getByText("This value already exists. Open it instead."),
    ).toHaveClass("text-black")
    expect(screen.getByLabelText("Value Name")).toHaveAttribute(
      "aria-invalid",
      "true",
    )
    expect(screen.getByRole("button", { name: "Review Update" })).toBeDisabled()
  })

  it("filters literal name and definition text while preserving the current presentation order", () => {
    const activeDeck = createActiveDeck([])
    const rankedValues = createRankedValues(activeDeck)

    renderAllValues(rankedValues)

    const search = screen.getByRole("searchbox", { name: "Search All Values" })
    fireEvent.change(search, { target: { value: "health" } })

    const expectedMatches = rankedValues.filter(({ definition }) =>
      getValueDisplayName(definition).toLocaleLowerCase().includes("health"),
    )
    expect(screen.getAllByRole("listitem")).toHaveLength(expectedMatches.length)
    expectedMatches.forEach(({ definition }) => {
      expect(screen.getByText(getValueDisplayName(definition))).toBeVisible()
    })

    const definitionSearchText = getValueDisplayDefinition(
      rankedValues[0].definition,
    )
      .slice(0, 12)
      .toLocaleLowerCase()
    fireEvent.change(search, { target: { value: definitionSearchText } })
    const expectedDefinitionMatches = rankedValues.filter(({ definition }) =>
      getValueDisplayDefinition(definition)
        .toLocaleLowerCase()
        .includes(definitionSearchText),
    )
    expect(screen.getAllByRole("listitem")).toHaveLength(
      expectedDefinitionMatches.length,
    )

    fireEvent.change(search, { target: { value: "" } })
    expect(screen.getAllByRole("listitem")).toHaveLength(
      CANONICAL_VALUES.length,
    )
  })

  it("marks the earned Top Five once and closes without changing data", () => {
    const activeDeck = createActiveDeck([])
    const rankedValues = rankValues(
      activeDeck,
      createInitialValueProgress(activeDeck),
    )
    const onClose = vi.fn()

    renderAllValues(
      rankedValues.map((value, index) =>
        index < 1
          ? {
              ...value,
              progress: {
                ...value.progress,
                totalXp: value.progress.totalXp + 2,
                profileComparisons: value.progress.profileComparisons + 2,
                profileWins: value.progress.profileWins + 2,
              },
            }
          : value,
      ),
      { onClose },
    )

    expect(screen.getAllByText("Top Five")).toHaveLength(1)
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("closes through Escape and keeps long value cells overflow-safe", () => {
    const onClose = vi.fn()

    renderAllValues(undefined, { onClose })

    fireEvent.keyDown(window, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)

    screen.getAllByRole("listitem").forEach((listItem) => {
      expect(listItem).toHaveClass("overflow-x-auto", "overflow-y-auto")
    })
    screen.getAllByText(/^“/).forEach((definitionCopy) => {
      expect(definitionCopy).toHaveClass(
        "overflow-x-auto",
        "overflow-y-auto",
        "break-words",
      )
    })
  })

  it("reports when a literal search has no matching value or definition", () => {
    renderAllValues()

    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search All Values" }),
      { target: { value: "zzzz-no-match" } },
    )

    expect(screen.getByText("No values match your search.")).toBeVisible()
    expect(screen.queryAllByRole("listitem")).toHaveLength(0)
  })
})

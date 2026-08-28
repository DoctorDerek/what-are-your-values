import { createActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createCustomValueId,
  type CustomValueDefinition,
} from "@game/data/src/Value"
import { createInitialValueProgress } from "@game/data/src/ValueProgress"
import { rankValues } from "@game/data/src/ValueRanking"
import { describe, expect, it, jest } from "@jest/globals"
import {
  render,
  screen,
  userEvent,
  within,
} from "@testing-library/react-native"
import NativeValueDetailsCard from "@/components/NativeValueDetailsCard"

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

describe("NativeValueDetailsCard", () => {
  it("presents canonical rank and definition without Custom Value actions", async () => {
    const [acceptance] = createRankedValues([])
    if (!acceptance) throw new Error("Canonical test value is unavailable")

    await render(
      <NativeValueDetailsCard
        isHighlighted={false}
        isPersistencePending={false}
        rankedValue={acceptance}
        showRank
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />,
    )

    const details = screen.getByLabelText("Acceptance details")
    expect(within(details).getByLabelText("Rank 1")).toBeOnTheScreen()
    expect(within(details).getByText("“to be accepted as I am”")).toBeOnTheScreen()
    expect(within(details).queryByText("Yours")).toBeNull()
    expect(within(details).queryByRole("button", { name: "Edit" })).toBeNull()
    expect(within(details).queryByRole("button", { name: "Delete" })).toBeNull()
  })

  it("routes highlighted Custom Value actions and locks them during persistence", async () => {
    const onDelete = jest.fn()
    const onEdit = jest.fn()
    const user = userEvent.setup()
    const rankedValue = createRankedValues([ingenuity]).find(
      ({ definition }) => definition.id === ingenuity.id,
    )
    if (!rankedValue) throw new Error("Custom test value is unavailable")

    const { rerender } = await render(
      <NativeValueDetailsCard
        isHighlighted
        isPersistencePending={false}
        rankedValue={rankedValue}
        showRank={false}
        onDelete={onDelete}
        onEdit={onEdit}
      />,
    )

    const details = screen.getByLabelText("Ingenuity details")
    expect(details).toHaveProp(
      "className",
      expect.stringContaining("border-mapache-vivid-primary-cyan"),
    )
    expect(within(details).queryByLabelText(`Rank ${rankedValue.rank}`)).toBeNull()
    expect(within(details).getByText("Yours")).toBeOnTheScreen()
    expect(
      within(details).getByText("“Ability to solve problems creatively.”"),
    ).toBeOnTheScreen()

    await user.press(within(details).getByRole("button", { name: "Edit" }))
    await user.press(within(details).getByRole("button", { name: "Delete" }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)

    await rerender(
      <NativeValueDetailsCard
        isHighlighted
        isPersistencePending
        rankedValue={rankedValue}
        showRank={false}
        onDelete={onDelete}
        onEdit={onEdit}
      />,
    )

    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled()
  })
})

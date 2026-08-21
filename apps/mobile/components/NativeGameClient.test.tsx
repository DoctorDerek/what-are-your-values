import { describe, expect, it, jest } from "@jest/globals"
import {
  render,
  screen,
  userEvent,
  within,
} from "@testing-library/react-native"
import NativeGameClient from "@/components/NativeGameClient"

jest.mock("@/lib/ExpoDurableStore", () => {
  const { createInMemoryDurableStore } = jest.requireActual<
    typeof import("@game/machines/src/InMemoryDurableStore")
  >("@game/machines/src/InMemoryDurableStore")

  return { expoDurableStore: createInMemoryDurableStore() }
})

jest.mock("@/components/useNativePlayerDataFiles", () => ({
  __esModule: true,
  default: () => ({
    isReadingImportFile: false,
    chooseBackup: async () => undefined,
  }),
}))

jest.mock("expo-crypto", () => {
  let nextUuid = 0

  return {
    randomUUID: () => {
      nextUuid += 1
      return `00000000-0000-4000-8000-${nextUuid.toString().padStart(12, "0")}`
    },
  }
})

async function openMenuDestination(
  user: ReturnType<typeof userEvent.setup>,
  destinationLabel: string,
) {
  await user.press(await screen.findByRole("button", { name: "Menu" }))
  const menu = (await screen.findAllByLabelText("Menu")).find(
    ({ props }) => props.role === "dialog",
  )
  if (!menu) throw new Error("The native Product Menu dialog is unavailable")
  await user.press(within(menu).getByRole("button", { name: destinationLabel }))
}

function getPresentedChoiceNames() {
  return screen
    .getAllByRole("button", { name: /^Choose / })
    .map(({ props }) => props.accessibilityLabel as unknown)
}

describe("NativeGameClient Menu navigation", () => {
  it("routes every shipped destination and resumes the exact active pair", async () => {
    const user = userEvent.setup()
    await render(<NativeGameClient />)

    await user.press(await screen.findByRole("button", { name: "Start" }))
    expect(await screen.findByText("Your Values")).toBeOnTheScreen()

    await openMenuDestination(user, "Browse All Values")
    expect(await screen.findByText("All Values")).toBeOnTheScreen()

    await openMenuDestination(user, "Custom Values")
    expect(await screen.findByText("Custom Value Builder")).toBeOnTheScreen()
    await user.press(screen.getByRole("button", { name: "Cancel" }))

    await openMenuDestination(user, "Achievements")
    expect(await screen.findByText("Achievements")).toBeOnTheScreen()

    await openMenuDestination(user, "Import & Export")
    expect(await screen.findByText("Import & Export")).toBeOnTheScreen()

    await openMenuDestination(user, "Browse All Values")
    await user.press(await screen.findByRole("button", { name: "Close" }))
    expect(await screen.findByText("Your Values")).toBeOnTheScreen()

    await user.press(screen.getByRole("button", { name: "Battle" }))
    const presentedChoiceNames = getPresentedChoiceNames()
    expect(presentedChoiceNames).toHaveLength(2)

    await openMenuDestination(user, "Controls")
    const controls = (await screen.findAllByLabelText("Controls")).find(
      ({ props }) => props.role === "dialog",
    )
    if (!controls) throw new Error("The native Controls dialog is unavailable")
    expect(
      within(controls).getByText("Tap the first value card"),
    ).toBeOnTheScreen()
    getPresentedChoiceNames().forEach((choiceName) =>
      expect(
        screen.getByRole("button", { name: String(choiceName) }),
      ).toBeDisabled(),
    )
    await user.press(
      within(controls).getAllByRole("button", { name: "Close" })[1],
    )
    expect(getPresentedChoiceNames()).toEqual(presentedChoiceNames)

    await openMenuDestination(user, "How It Works")
    expect(await screen.findByLabelText("How It Works")).toBeOnTheScreen()
    expect(
      screen.getByText("Start With 100 Values—or Add Your Own"),
    ).toBeOnTheScreen()
    await user.press(screen.getByRole("button", { name: "Close" }))

    expect(getPresentedChoiceNames()).toEqual(presentedChoiceNames)

    await user.press(screen.getByRole("button", { name: "Menu" }))
    await user.press(
      await screen.findByRole("button", { name: "Resume Battle" }),
    )

    expect(getPresentedChoiceNames()).toEqual(presentedChoiceNames)
  }, 10_000)
})

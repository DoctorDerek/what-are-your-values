import { createActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createSeethingSwarmTypographyOnlyRuntimeClipCatalog,
  type SeethingSwarmRuntimeCharacterClip,
  type SeethingSwarmRuntimeClipCatalog,
} from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import {
  createCustomValueId,
  getValueDisplayName,
  type CustomValueDefinition,
  type ValueId,
} from "@game/data/src/Value"
import {
  createInitialValueProgress,
  createValueProgress,
} from "@game/data/src/ValueProgress"
import { rankValues } from "@game/data/src/ValueRanking"
import { VALUE_TO_ANIMAL_MAP } from "@game/data/src/ValueToAnimalMap"
import { ZOO_ANIMALS } from "@game/data/src/ZooAnimals"
import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import NativeHub from "@/components/NativeHub"
import NativeSeethingSwarmAnimal from "@/components/NativeSeethingSwarmAnimal"

jest.mock("@/components/NativeSeethingSwarmAnimal", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native")
  return {
    __esModule: true,
    default: jest.fn(
      ({
        clip,
      }: {
        clip: SeethingSwarmRuntimeCharacterClip<number>
        shouldReduceMotion: boolean
      }) => (
        <View
          testID={`mock-seething-swarm-animal-${clip.animalId.replaceAll("/", "-")}`}
        />
      ),
    ),
  }
})

const activeDeck = createActiveDeck([])
const nativeAnimalRendererMock = jest.mocked(NativeSeethingSwarmAnimal)
const animalPresentationProps = Object.freeze({
  runtimeClipCatalog: createSeethingSwarmTypographyOnlyRuntimeClipCatalog(),
  shouldReduceMotion: false,
})
const licensedRuntimeClipCatalog = Object.freeze({
  mode: "licensed",
  evidenceSnapshotId: "seethingswarm-animals:hub-integration-test",
  animals: Object.freeze(
    ZOO_ANIMALS.map(({ id }, index) =>
      Object.freeze({
        animalId: id,
        characterClips: Object.freeze([
          Object.freeze({
            kind: "character",
            animalId: id,
            animationId: "idle",
            relativePath: `${id}/idle.png`,
            frameWidth: 1,
            frameHeight: 1,
            frameCount: 1,
            visibleBounds: Object.freeze({
              left: 0,
              top: 0,
              width: 1,
              height: 1,
            }),
            asset: index + 1,
          }),
        ]),
        auxiliaryEffectClips: Object.freeze([]),
      }),
    ),
  ),
  characterClipCount: ZOO_ANIMALS.length,
  auxiliaryEffectClipCount: 0,
}) satisfies SeethingSwarmRuntimeClipCatalog<number>

function getMappedAnimalId(valueId: ValueId) {
  const mapping = VALUE_TO_ANIMAL_MAP.find(
    ({ valueId: mappedValueId }) => mappedValueId === valueId,
  )
  if (!mapping) throw new Error(`Missing test animal mapping for ${valueId}`)
  return mapping.animalId
}

function createUnplayedRankedValues() {
  return rankValues(activeDeck, createInitialValueProgress(activeDeck))
}

function createRankedValuesWithEvidence() {
  const progressById = new Map(createInitialValueProgress(activeDeck))
  const firstValueId = activeDeck.valueIds[0]

  progressById.set(
    firstValueId,
    createValueProgress(firstValueId, {
      totalXp: 4,
      profileWins: 1,
      profileComparisons: 1,
      currentCycleWins: 1,
    }),
  )

  return rankValues(activeDeck, progressById)
}

function createCustomRankedValues() {
  const customValue = Object.freeze({
    kind: "custom",
    id: createCustomValueId("custom:00000000-0000-4000-8000-000000000777"),
    name: "🧠 Curiosity",
    definition: "Keep asking why and how.",
    creationOrdinal: 1,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  }) satisfies CustomValueDefinition
  const customActiveDeck = createActiveDeck([customValue])
  const progressById = new Map(createInitialValueProgress(customActiveDeck))
  progressById.set(
    customValue.id,
    createValueProgress(customValue.id, {
      totalXp: 100,
      profileWins: 1,
      profileComparisons: 1,
      currentCycleWins: 1,
    }),
  )
  return Object.freeze({
    customValue,
    rankedValues: rankValues(customActiveDeck, progressById),
  })
}

function createHubCallbacks() {
  return {
    onAddCustomValue: jest.fn(),
    onBrowseAllValues: jest.fn(),
    onOpenAchievements: jest.fn(),
    onOpenDataManagement: jest.fn(),
    onOpenMenu: jest.fn(),
    onOpenValue: jest.fn(),
    onStartBattle: jest.fn(),
  }
}

describe("NativeHub", () => {
  it("supports first-run discovery without presenting source order as a ranking", async () => {
    const callbacks = createHubCallbacks()
    const user = userEvent.setup()
    const rankedValues = createUnplayedRankedValues()
    await render(
      <NativeHub
        {...callbacks}
        {...animalPresentationProps}
        dataNotice={null}
        rankedValues={rankedValues}
      />,
    )

    expect(screen.getByText("Not ranked yet.")).toBeOnTheScreen()
    expect(
      screen.getByText(
        "Browse the included values, then battle when you are ready.",
      ),
    ).toBeOnTheScreen()
    expect(screen.queryByText("Top Five")).not.toBeOnTheScreen()
    expect(screen.queryByText("#1")).not.toBeOnTheScreen()
    expect(nativeAnimalRendererMock).not.toHaveBeenCalled()
    expect(
      screen.queryByTestId(/^hub-top-five-rank-\d+-presentation$/, {
        includeHiddenElements: true,
      }),
    ).not.toBeOnTheScreen()

    const visibleValueButtons = screen.getAllByRole("button", {
      name: /^Open .* in All Values$/,
    })

    expect(visibleValueButtons[0]).toHaveAccessibleName(
      "Open Acceptance in All Values",
    )
    expect(visibleValueButtons[1]).toHaveAccessibleName(
      "Open Accuracy in All Values",
    )
    expect(visibleValueButtons[2]).toHaveAccessibleName(
      "Open Achievement in All Values",
    )

    await user.press(screen.getByRole("button", { name: "Browse All Values" }))
    await user.press(screen.getByRole("button", { name: "Add Custom Value" }))
    await user.press(screen.getByRole("button", { name: "Menu" }))
    await user.press(visibleValueButtons[0])

    expect(callbacks.onBrowseAllValues).toHaveBeenCalledTimes(1)
    expect(callbacks.onAddCustomValue).toHaveBeenCalledTimes(1)
    expect(callbacks.onOpenMenu).toHaveBeenCalledTimes(1)
    expect(callbacks.onOpenValue).toHaveBeenCalledWith(
      rankedValues.find(
        ({ definition }) => getValueDisplayName(definition) === "Acceptance",
      )?.definition.id,
    )
  })

  it("presents committed evidence as Top Five followed by all other values", async () => {
    const callbacks = createHubCallbacks()
    const user = userEvent.setup()
    const rankedValues = createRankedValuesWithEvidence()
    const firstRankedValue = rankedValues[0]
    const firstRankedValueName = getValueDisplayName(
      firstRankedValue.definition,
    )
    await render(
      <NativeHub
        {...callbacks}
        {...animalPresentationProps}
        dataNotice="Your imported data is ready."
        rankedValues={rankedValues}
      />,
    )

    expect(
      screen.getByText("Your ranking is based on your committed battles."),
    ).toBeOnTheScreen()
    expect(screen.getByText("Top Five")).toBeOnTheScreen()
    expect(screen.getByText("All Other Values")).toBeOnTheScreen()
    expect(screen.getByText("Your imported data is ready.")).toBeOnTheScreen()
    expect(screen.getByText("#1")).toBeOnTheScreen()
    expect(nativeAnimalRendererMock).not.toHaveBeenCalled()

    await user.press(
      screen.getByRole("button", {
        name: `Rank 1. Open ${firstRankedValueName} in All Values`,
      }),
    )
    await user.press(screen.getByRole("button", { name: "Battle" }))

    expect(callbacks.onOpenValue).toHaveBeenCalledWith(
      firstRankedValue.definition.id,
    )
    expect(callbacks.onStartBattle).toHaveBeenCalledTimes(1)
  })

  it("renders exactly five mapped canonical animals and propagates Reduced Motion", async () => {
    const callbacks = createHubCallbacks()
    const rankedValues = createRankedValuesWithEvidence()
    await render(
      <NativeHub
        {...callbacks}
        runtimeClipCatalog={licensedRuntimeClipCatalog}
        dataNotice={null}
        rankedValues={rankedValues}
        shouldReduceMotion
      />,
    )

    const animalPresentations = screen.getAllByTestId(
      /^hub-top-five-rank-\d+-presentation$/,
      {
        includeHiddenElements: true,
      },
    )
    expect(animalPresentations).toHaveLength(5)
    for (const animalPresentation of animalPresentations) {
      expect(animalPresentation).toHaveProp("accessible", false)
      expect(animalPresentation).toHaveProp(
        "importantForAccessibility",
        "no-hide-descendants",
      )
      expect(animalPresentation).toHaveProp("pointerEvents", "none")
    }
    expect(
      Array.from(
        new Set(
          nativeAnimalRendererMock.mock.calls.map(
            ([{ clip }]) => clip.animalId,
          ),
        ),
      ),
    ).toEqual(
      rankedValues
        .slice(0, 5)
        .map(({ definition }) => getMappedAnimalId(definition.id)),
    )
    expect(
      nativeAnimalRendererMock.mock.calls.every(
        ([{ shouldReduceMotion }]) => shouldReduceMotion,
      ),
    ).toBe(true)
    expect(
      screen.queryByTestId("hub-top-five-rank-6-presentation", {
        includeHiddenElements: true,
      }),
    ).not.toBeOnTheScreen()
    const firstRankedValue = rankedValues[0]
    expect(
      screen.getByRole("button", {
        name: `Rank 1. Open ${getValueDisplayName(firstRankedValue.definition)} in All Values`,
      }),
    ).toBeOnTheScreen()
  })

  it("renders an equal Custom Value initial tile without inferring an animal", async () => {
    const callbacks = createHubCallbacks()
    const user = userEvent.setup()
    const { customValue, rankedValues } = createCustomRankedValues()
    await render(
      <NativeHub
        {...callbacks}
        runtimeClipCatalog={licensedRuntimeClipCatalog}
        dataNotice={null}
        rankedValues={rankedValues}
        shouldReduceMotion={false}
      />,
    )

    const customValueTile = screen.getByTestId(
      "hub-top-five-rank-1-presentation",
      { includeHiddenElements: true },
    )
    expect(customValueTile).toHaveStyle({ width: 72, height: 72 })
    expect(customValueTile).toHaveProp("accessible", false)
    expect(customValueTile).toHaveProp(
      "importantForAccessibility",
      "no-hide-descendants",
    )
    expect(
      screen.getByText("🧠", { includeHiddenElements: true }),
    ).toBeOnTheScreen()
    expect(
      screen.getAllByTestId(/^hub-top-five-rank-\d+-presentation$/, {
        includeHiddenElements: true,
      }),
    ).toHaveLength(5)
    expect(
      Array.from(
        new Set(
          nativeAnimalRendererMock.mock.calls.map(
            ([{ clip }]) => clip.animalId,
          ),
        ),
      ),
    ).toEqual(
      rankedValues
        .slice(1, 5)
        .map(({ definition }) => getMappedAnimalId(definition.id)),
    )

    await user.press(
      screen.getByRole("button", {
        name: "Rank 1. Open 🧠 Curiosity in All Values",
      }),
    )
    expect(callbacks.onOpenValue).toHaveBeenCalledWith(customValue.id)
  })
})

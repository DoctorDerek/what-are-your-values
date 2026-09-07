import { createActiveDeck } from "@game/data/src/ActiveDeck"
import {
  createSeethingSwarmTypographyOnlyRuntimeClipCatalog,
  type SeethingSwarmLicensedRuntimeClipCatalog,
} from "@game/data/src/SeethingSwarmRuntimeClipCatalog"
import { createCanonicalValueId } from "@game/data/src/Value"
import { createSchedulerRestorePoint } from "@game/machines/src/PairScheduler"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals"
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react-native"
import type { ComponentProps } from "react"
import { AppState, Pressable, View, type AppStateStatus } from "react-native"
import { getAnimatedStyle } from "react-native-reanimated"
import NativeSeethingSwarmBattleStage from "@/components/NativeSeethingSwarmBattleStage"

const pair = [
  createCanonicalValueId("pvcs-2011:mastery"),
  createCanonicalValueId("pvcs-2011:courage"),
] as const
const scheduler = createSchedulerRestorePoint({
  activeDeck: createActiveDeck([]),
  progressGeneration: 0,
  deckRevision: 0,
  seed: "native-stage-test",
  cycleIndex: 0,
  cursor: 0,
})
const battle = { pair, scheduler }
const animals = (["raccoonpack", "wolfpack"] as const).map(
  (animalId, animalIndex) => ({
    animalId,
    characterClips: ["run", "crouch", "idle", "attack", "hurt", "dance"].map(
      (animationId, animationIndex) => ({
        kind: "character" as const,
        animalId,
        animationId,
        relativePath: `${animalId}/${animationId}.png`,
        frameWidth: 32,
        frameHeight: 32,
        frameCount: 4,
        visibleBounds: { left: 2, top: 3, width: 24, height: 25 },
        asset: animalIndex * 100 + animationIndex + 1,
      }),
    ),
    auxiliaryEffectClips: [],
  }),
)
const licensedCatalog = {
  mode: "licensed",
  evidenceSnapshotId: "native-stage-test",
  animals,
  characterClipCount: 12,
  auxiliaryEffectClipCount: 0,
} satisfies SeethingSwarmLicensedRuntimeClipCatalog<number>
const hidden = { includeHiddenElements: true }
function props(): ComponentProps<typeof NativeSeethingSwarmBattleStage> {
  return {
    battle,
    catalog: licensedCatalog,
    winnerId: null,
    isNextBattleReady: false,
    isPaused: false,
    shouldReduceMotion: false,
    onResultComplete: jest.fn(),
    children: ({ first, second }) => (
      <>
        <Pressable accessibilityRole="button" accessibilityLabel="First value">
          {first(false)}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Second value">
          {second(false)}
        </Pressable>
      </>
    ),
  }
}
function image(animal: "raccoonpack" | "wolfpack") {
  const side = animal === "raccoonpack" ? "first" : "second"
  const clips = screen.getAllByTestId(
    new RegExp(`^battle-clip-${side}-`),
    hidden,
  )
  const visibleClip =
    clips.find((clip) => clip.props.className.includes("opacity-100")) ??
    clips[0]
  return within(visibleClip).getByTestId(
    `seething-swarm-animal-${animal}-image`,
    hidden,
  )
}
async function loadImages() {
  for (const node of screen.getAllByTestId(
    /^seething-swarm-animal-.+-image$/,
    hidden,
  ))
    await fireEvent(node, "load")
}
async function advance(milliseconds: number) {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds)
  })
}
let notifyAppState: (state: AppStateStatus) => void
let removeAppState: ReturnType<typeof jest.fn>

beforeEach(() => {
  jest.useFakeTimers()
  AppState.currentState = "active"
  jest.spyOn(View.prototype, "measureInWindow").mockImplementation(function (
    this: View,
    callback,
  ) {
    callback(
      0,
      this.props.testID === "battle-combatant-first" ? 0 : 200,
      112,
      112,
    )
  })
  removeAppState = jest.fn()
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_type, listener) => {
      notifyAppState = listener
      return { remove: removeAppState }
    })
})
afterEach(() => {
  jest.useRealTimers()
})

describe("NativeSeethingSwarmBattleStage", () => {
  it("keeps two facing animals through entry anticipation and looping rest", async () => {
    const initial = props()
    await render(<NativeSeethingSwarmBattleStage {...initial} />)
    const stage = screen.getByTestId("seething-swarm-battle-stage", hidden)
    expect(stage).toBeOnTheScreen()
    expect(screen.getAllByRole("button")).toHaveLength(2)
    expect(
      within(screen.getByRole("button", { name: "First value" })).getByTestId(
        "battle-combatant-first",
        hidden,
      ),
    ).toHaveProp("accessibilityElementsHidden", true)
    expect(
      within(screen.getByRole("button", { name: "Second value" })).getByTestId(
        "battle-combatant-second",
        hidden,
      ),
    ).toHaveProp("accessibilityElementsHidden", true)
    expect(
      screen.getAllByTestId("seething-swarm-animal-raccoonpack", hidden)[0],
    ).toHaveStyle({ transform: [{ scaleX: 1 }] })
    expect(
      screen.getAllByTestId("seething-swarm-animal-wolfpack", hidden)[0],
    ).toHaveStyle({ transform: [{ scaleX: -1 }] })
    expect(image("raccoonpack")).toHaveProp("source", 1)
    expect(image("wolfpack")).toHaveProp("source", 101)
    await loadImages()
    await advance(700)
    expect(image("raccoonpack")).toHaveProp("source", 2)
    expect(image("wolfpack")).toHaveProp("source", 102)
    await loadImages()
    await advance(700)
    expect(image("raccoonpack")).toHaveProp("source", 3)
    expect(image("wolfpack")).toHaveProp("source", 103)
    await loadImages()
    await advance(350)
    expect(
      getAnimatedStyle(
        within(
          screen.getByTestId("battle-clip-first-idle", hidden),
        ).getByTestId("seething-swarm-animal-raccoonpack-strip", hidden),
      ),
    ).toMatchObject({ transform: [{ translateX: -256 }] })
    expect(initial.onResultComplete).not.toHaveBeenCalled()
  })

  it.each([0, 1] as const)(
    "plays winner %i attack/flourish and opponent reaction before the pending boundary",
    async (winnerIndex) => {
      const initial = props()
      const selected = { ...initial, winnerId: pair[winnerIndex] }
      const { rerender } = await render(
        <NativeSeethingSwarmBattleStage {...initial} />,
      )
      await loadImages()
      await advance(100)
      await rerender(<NativeSeethingSwarmBattleStage {...selected} />)
      expect(image("raccoonpack")).toHaveProp("source", 3)
      expect(image("wolfpack")).toHaveProp("source", 103)
      await loadImages()
      await advance(200)
      expect(image("raccoonpack")).toHaveProp(
        "source",
        winnerIndex === 0 ? 4 : 3,
      )
      expect(image("wolfpack")).toHaveProp(
        "source",
        winnerIndex === 1 ? 104 : 103,
      )
      await loadImages()
      await advance(300)
      const winnerAnimal = winnerIndex === 0 ? "raccoonpack" : "wolfpack"
      expect(image(winnerAnimal)).toHaveProp(
        "source",
        winnerIndex === 0 ? 6 : 106,
      )
      expect(initial.onResultComplete).not.toHaveBeenCalled()
      await loadImages()
      await advance(500)
      expect(initial.onResultComplete).not.toHaveBeenCalled()
      await rerender(
        <NativeSeethingSwarmBattleStage {...selected} isNextBattleReady />,
      )
      expect(initial.onResultComplete).toHaveBeenCalledTimes(1)
      await rerender(
        <NativeSeethingSwarmBattleStage {...selected} isNextBattleReady />,
      )
      await advance(1000)
      expect(initial.onResultComplete).toHaveBeenCalledTimes(1)
    },
  )

  it("waits for both real clip completions even when persistence finishes first", async () => {
    const initial = { ...props(), winnerId: pair[0], isNextBattleReady: true }
    const { unmount } = await render(
      <NativeSeethingSwarmBattleStage {...initial} />,
    )
    const loadRole = async (side: "first" | "second", role: string) => {
      const clip = screen.getByTestId(`battle-clip-${side}-${role}`, hidden)
      await fireEvent(within(clip).getByTestId(/-image$/, hidden), "load")
    }
    await loadRole("first", "idle")
    await advance(300)
    expect(image("raccoonpack")).toHaveProp("source", 3)
    expect(initial.onResultComplete).not.toHaveBeenCalled()
    await loadRole("second", "idle")
    await advance(200)
    await loadRole("first", "attack")
    await advance(300)
    expect(initial.onResultComplete).not.toHaveBeenCalled()
    await loadRole("second", "hurt")
    await advance(500)
    expect(initial.onResultComplete).toHaveBeenCalledTimes(1)
    await unmount()
    expect(removeAppState).toHaveBeenCalledTimes(1)
  })

  it("renders calm reduced-motion animals and completes only after a pending pair exists", async () => {
    const initial = { ...props(), shouldReduceMotion: true }
    const { rerender } = await render(
      <NativeSeethingSwarmBattleStage {...initial} />,
    )
    await loadImages()
    expect(image("raccoonpack")).toHaveProp("source", 3)
    await rerender(
      <NativeSeethingSwarmBattleStage {...initial} winnerId={pair[0]} />,
    )
    expect(initial.onResultComplete).not.toHaveBeenCalled()
    await rerender(
      <NativeSeethingSwarmBattleStage
        {...initial}
        winnerId={pair[0]}
        isNextBattleReady
      />,
    )
    expect(initial.onResultComplete).toHaveBeenCalledTimes(1)
  })

  it("cancels background and reading-panel motion without losing a committed result", async () => {
    const initial = props()
    const { rerender } = await render(
      <NativeSeethingSwarmBattleStage {...initial} />,
    )
    await loadImages()
    await advance(80)
    await act(async () => notifyAppState("background"))
    expect(image("raccoonpack")).toHaveProp("source", 3)
    await rerender(
      <NativeSeethingSwarmBattleStage {...initial} winnerId={pair[1]} />,
    )
    expect(initial.onResultComplete).not.toHaveBeenCalled()
    await rerender(
      <NativeSeethingSwarmBattleStage
        {...initial}
        winnerId={pair[1]}
        isNextBattleReady
      />,
    )
    expect(initial.onResultComplete).toHaveBeenCalledTimes(1)
    await act(async () => notifyAppState("active"))
    const restored = {
      ...battle,
      scheduler: createSchedulerRestorePoint({
        ...scheduler,
        activeDeck: createActiveDeck([]),
        cursor: scheduler.cursor + 1,
      }),
    }
    await rerender(
      <NativeSeethingSwarmBattleStage
        {...initial}
        battle={restored}
        isPaused
      />,
    )
    await loadImages()
    expect(image("raccoonpack")).toHaveProp("source", 3)
    await rerender(
      <NativeSeethingSwarmBattleStage {...initial} battle={restored} />,
    )
    expect(image("raccoonpack")).toHaveProp("source", 1)
  })

  it("retains another loaded pose after a clip failure without blocking the result", async () => {
    const initial = { ...props(), winnerId: pair[0], isNextBattleReady: true }
    await render(<NativeSeethingSwarmBattleStage {...initial} />)
    await loadImages()
    await advance(200)
    await fireEvent(image("raccoonpack"), "error", {
      nativeEvent: { error: "decode failed" },
    })
    expect(screen.queryByTestId("battle-placeholder-first", hidden)).toBeNull()
    expect(image("raccoonpack")).toHaveProp("source", 6)
    await advance(550)
    await loadImages()
    await advance(550)
    expect(initial.onResultComplete).toHaveBeenCalledTimes(1)
  })

  it("plays a complete aerial attack and waits for its landing after the opponent reacts", async () => {
    const catalog = {
      ...licensedCatalog,
      animals: licensedCatalog.animals.map((animal) => ({
        ...animal,
        characterClips: animal.characterClips.flatMap((clip) => clip.animationId !== "attack" ? [clip]
          : ["takeoff", "attack_air", "land"].map((animationId, index) => ({
            ...clip, animationId, frameCount: animationId === "land" ? 8 : 4, asset: 201 + index,
          }))),
      })),
    }
    const initial = { ...props(), catalog, winnerId: pair[0], isNextBattleReady: true }
    await render(<NativeSeethingSwarmBattleStage {...initial} />)
    await loadImages()
    await advance(200)
    expect(image("raccoonpack")).toHaveProp("source", 201)
    await advance(300)
    expect(image("raccoonpack")).toHaveProp("source", 202)
    await advance(300)
    expect(image("raccoonpack")).toHaveProp("source", 203)
    expect(image("wolfpack")).toHaveProp("source", 105)
    await advance(300)
    expect(initial.onResultComplete).not.toHaveBeenCalled()
    await advance(300)
    expect(initial.onResultComplete).toHaveBeenCalledTimes(1)
  })

  it("keeps two animated public-clone animals and resets result ownership with the battle", async () => {
    const initial = {
      ...props(),
      catalog: createSeethingSwarmTypographyOnlyRuntimeClipCatalog(),
    }
    const { rerender, unmount } = await render(
      <NativeSeethingSwarmBattleStage {...initial} />,
    )
    await advance(150)
    expect(
      getAnimatedStyle(screen.getByTestId("battle-placeholder-first", hidden)),
    ).not.toMatchObject({
      transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: "0deg" }],
    })
    for (const side of ["first", "second"])
      expect(
        within(
          screen.getByTestId(`battle-combatant-${side}`, hidden),
        ).getByTestId(`battle-placeholder-${side}`, hidden),
      ).toBeOnTheScreen()
    await rerender(
      <NativeSeethingSwarmBattleStage
        {...initial}
        winnerId={pair[0]}
        isNextBattleReady
      />,
    )
    await advance(200)
    expect(initial.onResultComplete).not.toHaveBeenCalled()
    const restored = {
      ...battle,
      scheduler: createSchedulerRestorePoint({
        ...scheduler,
        activeDeck: createActiveDeck([]),
        cursor: scheduler.cursor + 1,
      }),
    }
    await rerender(
      <NativeSeethingSwarmBattleStage
        {...initial}
        battle={restored}
        winnerId={pair[1]}
        isNextBattleReady
      />,
    )
    await advance(300)
    expect(initial.onResultComplete).not.toHaveBeenCalled()
    await advance(550)
    expect(initial.onResultComplete).not.toHaveBeenCalled()
    await advance(550)
    expect(initial.onResultComplete).toHaveBeenCalledTimes(1)
    await unmount()
    await advance(1000)
    expect(initial.onResultComplete).toHaveBeenCalledTimes(1)
  })
})

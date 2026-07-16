import { LIST_OF_VALUES } from "@game/data/src/ListOfValues"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createActor } from "xstate"
import { combatMachine } from "./CombatMachine"

describe("Combat Machine Integration", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("automatically regenerates queue when completely empty", () => {
    const mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    }

    const actor = createActor(combatMachine, {
      input: { storage: mockStorage },
    })

    actor.start()

    actor.send({
      type: "INITIALIZE",
      queue: [[1, 2]],
      valueIds: [1, 2],
    })

    let state = actor.getSnapshot()

    expect(state.matches("AwaitingInput")).toBe(true)
    expect(state.context.currentPair).toEqual([1, 2])
    expect(state.context.matchupQueue.length).toBe(0)

    actor.send({ type: "SELECT_WINNER", winnerId: 1 })

    state = actor.getSnapshot()
    expect(state.matches("Animating")).toBe(true)

    vi.advanceTimersByTime(500)

    state = actor.getSnapshot()

    expect(state.matches("AwaitingInput")).toBe(true)

    expect(state.context.currentPair).not.toBeNull()
    expect(state.context.matchupQueue.length).toBeGreaterThan(10)
  })
})

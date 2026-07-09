import { LIST_OF_VALUES } from "@game/data/src/ListOfValues"
import { generateQueue } from "@game/utils/src/Queue"
import { assign, setup } from "xstate"
import { StorageAdapter } from "./StorageAdapter"

export const combatMachine = setup({
  types: {
    context: {} as {
      matchupQueue: [number, number][]
      currentPair: [number, number] | null
      winnerId: number | null
      focusedId: number | null
      storage: StorageAdapter
    },
    events: {} as
      | { type: "INITIALIZE"; queue: [number, number][]; valueIds: number[] }
      | { type: "FOCUS_VALUE"; id: number }
      | { type: "SELECT_WINNER"; winnerId: number },
    input: {} as { storage: StorageAdapter },
  },
  actions: {
    saveQueue: ({ context }) => {
      context.storage.setItem(
        "wayvm_queue",
        JSON.stringify(context.matchupQueue),
      )
    },
  },
}).createMachine({
  id: "combat",
  initial: "Initializing",
  context: ({ input }) => ({
    matchupQueue: [],
    currentPair: null,
    winnerId: null,
    focusedId: null,
    storage: input.storage,
  }),
  states: {
    Initializing: {
      on: {
        INITIALIZE: {
          target: "CheckingQueue",
          actions: assign({
            matchupQueue: ({ event }) => {
              if (event.queue.length > 0) return event.queue
              return generateQueue(event.valueIds)
            },
          }),
        },
      },
    },
    CheckingQueue: {
      always: [
        {
          guard: ({ context }) => context.matchupQueue.length === 0,
          target: "Regenerating",
        },
        {
          target: "AwaitingInput",
          actions: [
            assign({
              currentPair: ({ context }) =>
                context.matchupQueue[context.matchupQueue.length - 1],
              matchupQueue: ({ context }) => context.matchupQueue.slice(0, -1),
              focusedId: null,
              winnerId: null,
            }),
            "saveQueue",
          ],
        },
      ],
    },
    Regenerating: {
      always: {
        target: "CheckingQueue",
        actions: assign({
          matchupQueue: () => {
            const ids = LIST_OF_VALUES.map((v) => v.id)
            return generateQueue(ids)
          },
        }),
      },
    },
    AwaitingInput: {
      on: {
        FOCUS_VALUE: {
          actions: assign({
            focusedId: ({ event }) => event.id,
          }),
        },
        SELECT_WINNER: {
          target: "Animating",
          actions: assign({
            winnerId: ({ event }) => event.winnerId,
            focusedId: null,
          }),
        },
      },
    },
    Animating: {
      after: {
        500: { target: "CheckingQueue" },
      },
    },
  },
})

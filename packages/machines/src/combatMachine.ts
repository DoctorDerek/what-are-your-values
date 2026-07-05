import { generateQueue } from "@what-are-your-values-mapache/utils/src/queue"
import { assign, setup } from "xstate"

export const combatMachine = setup({
  types: {
    context: {} as {
      matchupQueue: [number, number][]
      currentPair: [number, number] | null
      winnerId: number | null
      focusedId: number | null
    },
    events: {} as
      | { type: "INITIALIZE"; queue: [number, number][]; valueIds: number[] }
      | { type: "FOCUS_VALUE"; id: number }
      | { type: "SELECT_WINNER"; winnerId: number },
  },
  actions: {
    saveQueue: ({ context }) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "wayvm_queue",
          JSON.stringify(context.matchupQueue),
        )
      }
    },
  },
}).createMachine({
  id: "combat",
  initial: "Initializing",
  context: {
    matchupQueue: [],
    currentPair: null,
    winnerId: null,
    focusedId: null,
  },
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
            const ids = []
            for (let i = 1; i <= 83; i++) ids.push(i)
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

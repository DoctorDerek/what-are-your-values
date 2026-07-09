import { assign, setup } from "xstate"
import { StorageAdapter } from "./StorageAdapter"

export const rootMachine = setup({
  types: {
    context: {} as {
      uuid: string | null
      valuesXp: Record<number, number>
      storage: StorageAdapter
    },
    events: {} as
      | {
          type: "HYDRATE"
          uuid: string | null
          valuesXp: Record<number, number>
        }
      | { type: "SUBMIT_SPLASH"; uuid: string }
      | { type: "START_BATTLE" }
      | {
          type: "BATTLE_COMPLETED"
          winnerId: number
          loserId: number
          xpGained: number
        }
      | { type: "EXIT_BATTLE" },
    input: {} as { storage: StorageAdapter },
  },
  actions: {
    saveRootState: ({ context }) => {
      if (context.uuid) context.storage.setItem("wayvm_uuid", context.uuid)
      context.storage.setItem(
        "wayvm_values_xp",
        JSON.stringify(context.valuesXp),
      )
    },
  },
}).createMachine({
  id: "root",
  initial: "Hydrating",
  context: ({ input }) => ({
    uuid: null,
    valuesXp: {},
    storage: input.storage,
  }),
  states: {
    Hydrating: {
      on: {
        HYDRATE: [
          {
            guard: ({ event }) => event.uuid !== null,
            target: "Hub",
            actions: assign({
              uuid: ({ event }) => event.uuid,
              valuesXp: ({ event }) => event.valuesXp,
            }),
          },
          {
            target: "Splash",
            actions: assign({
              uuid: ({ event }) => event.uuid,
              valuesXp: ({ event }) => event.valuesXp,
            }),
          },
        ],
      },
    },
    Splash: {
      on: {
        SUBMIT_SPLASH: {
          target: "Hub",
          actions: [
            assign({
              uuid: ({ event }) => event.uuid,
            }),
            "saveRootState",
          ],
        },
      },
    },
    Hub: {
      on: {
        START_BATTLE: { target: "Crucible" },
      },
    },
    Crucible: {
      on: {
        EXIT_BATTLE: { target: "Hub" },
        BATTLE_COMPLETED: {
          actions: [
            assign({
              valuesXp: ({ context, event }) => {
                const newXp = { ...context.valuesXp }
                newXp[event.winnerId] =
                  (newXp[event.winnerId] || 0) + event.xpGained
                return newXp
              },
            }),
            "saveRootState",
          ],
        },
      },
    },
  },
})

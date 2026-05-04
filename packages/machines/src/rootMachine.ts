import { setup, assign } from "xstate"

export const rootMachine = setup({
  types: {
    context: {} as {
      uuid: string | null
      optIn: boolean | null
      valuesXp: Record<number, number>
    },
    events: {} as
      | { type: "HYDRATE"; uuid: string | null; optIn: boolean | null; valuesXp: Record<number, number> }
      | { type: "SUBMIT_OPT_IN"; optIn: boolean; uuid: string }
      | { type: "START_BATTLE" }
      | { type: "BATTLE_COMPLETED"; winnerId: number; loserId: number; xpGained: number }
      | { type: "EXIT_BATTLE" }
  },
  actions: {
    saveRootState: ({ context }) => {
      if (typeof window !== "undefined") {
        if (context.uuid) window.localStorage.setItem("wayvm_uuid", context.uuid)
        if (context.optIn !== null) window.localStorage.setItem("wayvm_opt_in", String(context.optIn))
        window.localStorage.setItem("wayvm_values_xp", JSON.stringify(context.valuesXp))
      }
    }
  }
}).createMachine({
  id: "root",
  initial: "Hydrating",
  context: {
    uuid: null,
    optIn: null,
    valuesXp: {}
  },
  states: {
    Hydrating: {
      on: {
        HYDRATE: [
          {
            guard: ({ event }) => event.uuid !== null && event.optIn !== null,
            target: "Hub",
            actions: assign({
              uuid: ({ event }) => event.uuid,
              optIn: ({ event }) => event.optIn,
              valuesXp: ({ event }) => event.valuesXp
            })
          },
          {
            target: "Splash",
            actions: assign({
              uuid: ({ event }) => event.uuid,
              optIn: ({ event }) => event.optIn,
              valuesXp: ({ event }) => event.valuesXp
            })
          }
        ]
      }
    },
    Splash: {
      on: {
        SUBMIT_OPT_IN: {
          target: "Hub",
          actions: [
            assign({
              optIn: ({ event }) => event.optIn,
              uuid: ({ event }) => event.uuid
            }),
            "saveRootState"
          ]
        }
      }
    },
    Hub: {
      on: {
        START_BATTLE: { target: "Crucible" }
      }
    },
    Crucible: {
      on: {
        EXIT_BATTLE: { target: "Hub" },
        BATTLE_COMPLETED: {
          actions: [
            assign({
              valuesXp: ({ context, event }) => {
                const newXp = { ...context.valuesXp }
                newXp[event.winnerId] = (newXp[event.winnerId] || 0) + event.xpGained
                return newXp
              }
            }),
            "saveRootState"
          ]
        }
      }
    }
  }
})

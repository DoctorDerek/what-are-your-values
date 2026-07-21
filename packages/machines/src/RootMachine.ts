import type { ValueId } from "@game/data/src/Value"
import { assign, setup } from "xstate"
import {
  createBattleCycleCandidate,
  createInitialBattleCycle,
  type BattleCycleState,
} from "./BattleCycle"
import {
  projectScheduledPair,
  type SchedulerRestorePoint,
} from "./PairScheduler"
import { areSchedulerIdentitiesEqual } from "./SchedulerIdentity"
import type { StorageAdapter } from "./StorageAdapter"

export const rootMachine = setup({
  types: {
    context: {} as {
      uuid: string | null
      battleCycle: BattleCycleState | null
      storage: StorageAdapter
    },
    events: {} as
      | {
          type: "APP.HYDRATED"
          uuid: string | null
          schedulerSeed: string
        }
      | { type: "INTRODUCTION.COMPLETED"; uuid: string }
      | { type: "BATTLE.START_REQUESTED" }
      | { type: "ALL_VALUES.OPEN_REQUESTED" }
      | { type: "ALL_VALUES.CLOSE_REQUESTED" }
      | {
          type: "BATTLE.WINNER_SELECTED"
          winnerId: ValueId
          expectedScheduler: SchedulerRestorePoint
        }
      | { type: "BATTLE.EXIT_REQUESTED" },
    input: {} as { storage: StorageAdapter },
  },
  guards: {
    isCurrentBattleSelection: ({ context, event }) => {
      if (event.type !== "BATTLE.WINNER_SELECTED" || !context.battleCycle) {
        return false
      }

      if (
        !areSchedulerIdentitiesEqual(
          context.battleCycle.scheduler,
          event.expectedScheduler,
        )
      ) {
        return false
      }

      return projectScheduledPair(
        context.battleCycle.activeDeck,
        context.battleCycle.scheduler,
      ).pair.includes(event.winnerId)
    },
  },
  actions: {
    saveIntroductionId: ({ context }) => {
      if (!context.uuid) {
        throw new Error("Introduction completion is missing a UUID")
      }

      context.storage.setItem("wayvm_uuid", context.uuid)
    },
  },
}).createMachine({
  id: "root",
  initial: "Hydrating",
  context: ({ input }) => ({
    uuid: null,
    battleCycle: null,
    storage: input.storage,
  }),
  states: {
    Hydrating: {
      on: {
        "APP.HYDRATED": [
          {
            guard: ({ event }) => event.uuid !== null,
            target: "Hub",
            actions: assign({
              uuid: ({ event }) => event.uuid,
              battleCycle: ({ event }) =>
                createInitialBattleCycle(event.schedulerSeed),
            }),
          },
          {
            target: "Splash",
            actions: assign({
              uuid: ({ event }) => event.uuid,
              battleCycle: ({ event }) =>
                createInitialBattleCycle(event.schedulerSeed),
            }),
          },
        ],
      },
    },
    Splash: {
      on: {
        "INTRODUCTION.COMPLETED": {
          target: "Hub",
          actions: [
            assign({
              uuid: ({ event }) => event.uuid,
            }),
            "saveIntroductionId",
          ],
        },
      },
    },
    Hub: {
      on: {
        "BATTLE.START_REQUESTED": { target: "Crucible" },
        "ALL_VALUES.OPEN_REQUESTED": { target: "AllValues" },
      },
    },
    AllValues: {
      on: {
        "ALL_VALUES.CLOSE_REQUESTED": { target: "Hub" },
      },
    },
    Crucible: {
      on: {
        "BATTLE.EXIT_REQUESTED": { target: "Hub" },
        "BATTLE.WINNER_SELECTED": {
          guard: "isCurrentBattleSelection",
          actions: assign({
            battleCycle: ({ context, event }) => {
              if (!context.battleCycle) {
                throw new Error("Battle profile is not initialized")
              }

              return createBattleCycleCandidate({
                battleCycle: context.battleCycle,
                winnerId: event.winnerId,
                expectedScheduler: event.expectedScheduler,
              })
            },
          }),
        },
      },
    },
  },
})

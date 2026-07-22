import type { ValueId } from "@game/data/src/Value"
import { assign, setup } from "xstate"
import {
  applyBattleChoice,
  applyBattleRedo,
  applyBattleUndo,
  createInitialBattleProfile,
  type BattleProfile,
} from "./BattleProfile"
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
      battleProfile: BattleProfile | null
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
      | { type: "BATTLE.UNDO_REQUESTED" }
      | { type: "BATTLE.REDO_REQUESTED" }
      | { type: "BATTLE.EXIT_REQUESTED" },
    input: {} as { storage: StorageAdapter },
  },
  guards: {
    isCurrentBattleSelection: ({ context, event }) => {
      if (event.type !== "BATTLE.WINNER_SELECTED" || !context.battleProfile) {
        return false
      }

      if (
        !areSchedulerIdentitiesEqual(
          context.battleProfile.scheduler,
          event.expectedScheduler,
        )
      ) {
        return false
      }

      return projectScheduledPair(
        context.battleProfile.activeDeck,
        context.battleProfile.scheduler,
      ).pair.includes(event.winnerId)
    },
    canUndoBattle: ({ context }) =>
      (context.battleProfile?.history.length ?? 0) > 0,
    canRedoBattle: ({ context }) =>
      (context.battleProfile?.redo.length ?? 0) > 0,
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
    battleProfile: null,
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
              battleProfile: ({ event }) =>
                createInitialBattleProfile(event.schedulerSeed),
            }),
          },
          {
            target: "Splash",
            actions: assign({
              uuid: ({ event }) => event.uuid,
              battleProfile: ({ event }) =>
                createInitialBattleProfile(event.schedulerSeed),
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
            battleProfile: ({ context, event }) => {
              if (!context.battleProfile) {
                throw new Error("Battle profile is not initialized")
              }

              return applyBattleChoice({
                profile: context.battleProfile,
                winnerId: event.winnerId,
                expectedScheduler: event.expectedScheduler,
              }).profile
            },
          }),
        },
        "BATTLE.UNDO_REQUESTED": {
          guard: "canUndoBattle",
          actions: assign({
            battleProfile: ({ context }) => {
              if (!context.battleProfile) {
                throw new Error("Battle profile is not initialized")
              }

              const transition = applyBattleUndo(context.battleProfile)
              if (!transition) {
                throw new Error("Battle Undo is unavailable")
              }

              return transition.profile
            },
          }),
        },
        "BATTLE.REDO_REQUESTED": {
          guard: "canRedoBattle",
          actions: assign({
            battleProfile: ({ context }) => {
              if (!context.battleProfile) {
                throw new Error("Battle profile is not initialized")
              }

              const transition = applyBattleRedo(context.battleProfile)
              if (!transition) {
                throw new Error("Battle Redo is unavailable")
              }

              return transition.profile
            },
          }),
        },
      },
    },
  },
})

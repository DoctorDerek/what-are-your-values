import {
  getValueDisplayDefinition,
  getValueDisplayName,
} from "@game/data/src/Value"
import { createInitialBattleCycle } from "@game/machines/src/BattleCycle"
import type { PresentedBattle } from "@game/machines/src/CombatMachine"
import { projectScheduledPair } from "@game/machines/src/PairScheduler"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import Crucible from "./Crucible"

function createBattleProps(seed: string) {
  const battleCycle = createInitialBattleCycle(seed)
  const battle = Object.freeze({
    pair: projectScheduledPair(battleCycle.activeDeck, battleCycle.scheduler)
      .pair,
    scheduler: battleCycle.scheduler,
  }) satisfies PresentedBattle

  return { battleCycle, battle }
}

function createHistoryProps() {
  return {
    canUndo: false,
    canRedo: false,
    isPersistencePending: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
  }
}

describe("Crucible Component Integration", () => {
  it("renders semantic canonical values and commits a keyboard selection once", async () => {
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps("keyboard-battle-seed")
    const [winnerId, loserId] = battle.pair
    const winner = battleCycle.activeDeck.values.find(
      ({ id }) => id === winnerId,
    )
    const loser = battleCycle.activeDeck.values.find(({ id }) => id === loserId)
    if (!winner || !loser) {
      throw new Error("Projected definitions are missing")
    }

    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={vi.fn()}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    expect(await screen.findByText(getValueDisplayName(winner))).toBeVisible()
    expect(screen.getByText(getValueDisplayName(loser))).toBeVisible()

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }))
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "1" }))
    })

    expect(onWinnerSelected).toHaveBeenCalledTimes(1)
    expect(onWinnerSelected).toHaveBeenCalledWith(
      winnerId,
      battleCycle.scheduler,
    )
  })

  it("commits the first pointer activation exactly once", async () => {
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps("pointer-battle-seed")
    const [winnerId] = battle.pair
    const winner = battleCycle.activeDeck.values.find(
      ({ id }) => id === winnerId,
    )
    if (!winner) {
      throw new Error("Projected winner definition is missing")
    }

    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={vi.fn()}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    const cardA = await screen.findByRole("button", {
      name: `Choose ${getValueDisplayName(winner)}`,
    })

    act(() => cardA.click())
    expect(onWinnerSelected).toHaveBeenCalledWith(winnerId, battle.scheduler)

    act(() => cardA.click())
    expect(onWinnerSelected).toHaveBeenCalledTimes(1)
  })

  it("shows the definition inside the one-tap value choice", async () => {
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps("definition-battle-seed")
    const [valueId] = battle.pair
    const definition = battleCycle.activeDeck.values.find(
      ({ id }) => id === valueId,
    )
    if (!definition) {
      throw new Error("Projected value definition is missing")
    }

    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={vi.fn()}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    const choice = await screen.findByRole("button", {
      name: `Choose ${getValueDisplayName(definition)}`,
    })
    const definitionCopy = screen.getByText(
      `“${getValueDisplayDefinition(definition)}”`,
    )

    expect(choice).toHaveAccessibleDescription(
      `“${getValueDisplayDefinition(definition)}”`,
    )
    expect(choice).toContainElement(definitionCopy)
    expect(document.querySelector("details")).not.toBeInTheDocument()
    expect(screen.queryByText(/^Definition of /)).not.toBeInTheDocument()
    fireEvent.click(definitionCopy)
    expect(onWinnerSelected).toHaveBeenCalledTimes(1)
  })

  it("supports arrow focus, keyboard confirmation, and Escape", async () => {
    const onExit = vi.fn()
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps("navigation-battle-seed")
    const [, winnerId] = battle.pair

    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={onExit}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    const winner = battleCycle.activeDeck.values.find(
      ({ id }) => id === winnerId,
    )
    if (!winner) {
      throw new Error("Projected winner definition is missing")
    }
    const cardB = await screen.findByRole("button", {
      name: `Choose ${getValueDisplayName(winner)}`,
    })

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }))
    })
    expect(cardB.className).toContain("ring-8")
    expect(cardB).toHaveFocus()

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))
    })

    expect(onWinnerSelected).toHaveBeenCalledWith(winnerId, battle.scheduler)
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it("keeps both value cards vertically readable without horizontal overflow", async () => {
    const { battleCycle, battle } = createBattleProps("readable-copy-seed")
    const definitions = battle.pair.map((valueId) => {
      const definition = battleCycle.activeDeck.values.find(
        ({ id }) => id === valueId,
      )
      if (!definition) {
        throw new Error("Projected value definition is missing")
      }

      return definition
    })

    render(
      <Crucible
        {...createHistoryProps()}
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        onExit={vi.fn()}
        onWinnerSelected={vi.fn()}
      />,
    )

    expect(screen.getByRole("main", { name: "Value battle" })).toHaveClass(
      "overflow-hidden",
      "overscroll-none",
      "select-none",
      "touch-manipulation",
    )

    for (const definition of definitions) {
      const choice = await screen.findByRole("button", {
        name: `Choose ${getValueDisplayName(definition)}`,
      })
      const heading = screen.getByRole("heading", {
        name: getValueDisplayName(definition),
      })
      const definitionCopy = screen.getByText(
        `“${getValueDisplayDefinition(definition)}”`,
      )

      expect(choice.parentElement).toHaveClass(
        "min-h-0",
        "min-w-0",
        "overflow-x-hidden",
        "overflow-y-auto",
        "overscroll-contain",
      )
      expect(heading).toHaveClass("break-words", "[overflow-wrap:anywhere]")
      expect(definitionCopy).toHaveClass(
        "break-words",
        "[overflow-wrap:anywhere]",
      )
    }
  })

  it("routes available Undo and Redo controls without selecting a value", async () => {
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps("history-control-seed")
    const firstDefinition = battleCycle.activeDeck.values.find(
      ({ id }) => id === battle.pair[0],
    )
    if (!firstDefinition) {
      throw new Error("Projected value definition is missing")
    }

    render(
      <Crucible
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        canUndo
        canRedo
        isPersistencePending={false}
        onExit={vi.fn()}
        onUndo={onUndo}
        onRedo={onRedo}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    await screen.findByRole("button", {
      name: `Choose ${getValueDisplayName(firstDefinition)}`,
    })

    fireEvent.click(screen.getByRole("button", { name: "Undo" }))
    fireEvent.keyDown(window, { key: "y" })
    fireEvent.keyDown(window, { key: "z", repeat: true })

    expect(onUndo).toHaveBeenCalledTimes(1)
    expect(onRedo).toHaveBeenCalledTimes(1)
    expect(onWinnerSelected).not.toHaveBeenCalled()
  })

  it("disables every battle action while a durable write is pending", async () => {
    const onExit = vi.fn()
    const onUndo = vi.fn()
    const onRedo = vi.fn()
    const onWinnerSelected = vi.fn()
    const { battleCycle, battle } = createBattleProps(
      "pending-persistence-seed",
    )

    render(
      <Crucible
        activeDeck={battleCycle.activeDeck}
        battle={battle}
        progressById={battleCycle.progressById}
        canUndo
        canRedo
        isPersistencePending
        onExit={onExit}
        onUndo={onUndo}
        onRedo={onRedo}
        onWinnerSelected={onWinnerSelected}
      />,
    )

    await screen.findAllByRole("button", { name: /^Choose / })
    expect(screen.getByRole("main", { name: "Value battle" })).toHaveAttribute(
      "aria-busy",
      "true",
    )
    screen.getAllByRole("button").forEach((button) => {
      expect(button).toBeDisabled()
      fireEvent.click(button)
    })
    fireEvent.keyDown(window, { key: "1" })
    fireEvent.keyDown(window, { key: "z" })
    fireEvent.keyDown(window, { key: "y" })
    fireEvent.keyDown(window, { key: "Escape" })

    expect(onExit).not.toHaveBeenCalled()
    expect(onUndo).not.toHaveBeenCalled()
    expect(onRedo).not.toHaveBeenCalled()
    expect(onWinnerSelected).not.toHaveBeenCalled()
  })
})


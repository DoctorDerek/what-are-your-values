import { describe, expect, it } from "vitest"
import {
  CONTROL_ACTION_LABELS,
  CONTROL_SEMANTIC_ACTIONS,
  CONTROLS_COPY,
  NATIVE_CONTROL_GROUPS,
  WEB_CONTROL_GROUPS,
} from "./Controls"

describe("Controls", () => {
  it("owns the six semantic actions before platform-specific bindings", () => {
    expect(CONTROLS_COPY).toEqual({
      title: "Controls",
      introduction:
        "Use these controls to choose values, reverse recent choices, open Menu, or stop battling. Opening Controls does not change your progress.",
      semanticActionsHeading: "Actions",
      bindingsHeading: "Available Controls",
      closeAction: "Close",
    })
    expect(CONTROL_SEMANTIC_ACTIONS).toEqual([
      {
        id: "select-first-value",
        description: "Choose the first value card.",
      },
      {
        id: "select-second-value",
        description: "Choose the second value card.",
      },
      { id: "undo", description: "Reverse your most recent choice." },
      {
        id: "redo",
        description: "Restore the choice you most recently undid.",
      },
      {
        id: "menu",
        description: "Open Menu without changing the current pair.",
      },
      {
        id: "stop",
        description: "Stop battling and return to Your Values.",
      },
    ])
    expect(
      CONTROL_SEMANTIC_ACTIONS.map(({ id }) => CONTROL_ACTION_LABELS[id]),
    ).toEqual([
      "Select First Value",
      "Select Second Value",
      "Undo",
      "Redo",
      "Menu",
      "Stop",
    ])
  })

  it("describes only implemented web and native input paths", () => {
    expect(WEB_CONTROL_GROUPS).toEqual([
      {
        id: "touch-pointer",
        title: "Touch & Pointer",
        bindings: [
          {
            actionId: "select-first-value",
            input: "Tap or primary-click the first value card",
          },
          {
            actionId: "select-second-value",
            input: "Tap or primary-click the second value card",
          },
          { actionId: "undo", input: "Activate Undo" },
          { actionId: "redo", input: "Activate Redo" },
          { actionId: "menu", input: "Activate Menu" },
          { actionId: "stop", input: "Activate Stop" },
        ],
      },
      {
        id: "keyboard",
        title: "Keyboard",
        bindings: [
          { actionId: "select-first-value", input: "1 or A" },
          { actionId: "select-second-value", input: "2 or D" },
          {
            actionId: "move-focus",
            input: "Tab, Shift+Tab, or Arrow keys",
          },
          { actionId: "confirm-focused-value", input: "Enter or Space" },
          { actionId: "undo", input: "Z, Ctrl+Z, or Cmd+Z" },
          {
            actionId: "redo",
            input: "Y, Ctrl+Y, or Cmd+Shift+Z",
          },
          { actionId: "menu", input: "Escape" },
          {
            actionId: "stop",
            input: "Activate the visible Stop control",
          },
        ],
      },
    ])
    expect(NATIVE_CONTROL_GROUPS).toEqual([
      {
        id: "touch",
        title: "Touch",
        bindings: [
          { actionId: "select-first-value", input: "Tap the first value card" },
          {
            actionId: "select-second-value",
            input: "Tap the second value card",
          },
          { actionId: "undo", input: "Tap Undo" },
          { actionId: "redo", input: "Tap Redo" },
          { actionId: "menu", input: "Tap Menu" },
          { actionId: "stop", input: "Tap Stop" },
        ],
      },
    ])

    expect(
      JSON.stringify({
        semanticActions: CONTROL_SEMANTIC_ACTIONS,
        web: WEB_CONTROL_GROUPS,
        native: NATIVE_CONTROL_GROUPS,
      }),
    ).not.toMatch(
      /controller|remap|backspace|mouse back|mouse forward|auxiliary/i,
    )
  })

  it("freezes every shared Controls collection and entry", () => {
    expect(Object.isFrozen(CONTROLS_COPY)).toBe(true)
    expect(Object.isFrozen(CONTROL_ACTION_LABELS)).toBe(true)
    expect(Object.isFrozen(CONTROL_SEMANTIC_ACTIONS)).toBe(true)
    expect(
      CONTROL_SEMANTIC_ACTIONS.every((action) => Object.isFrozen(action)),
    ).toBe(true)

    for (const groups of [WEB_CONTROL_GROUPS, NATIVE_CONTROL_GROUPS]) {
      expect(Object.isFrozen(groups)).toBe(true)
      expect(groups.every((group) => Object.isFrozen(group))).toBe(true)
      expect(groups.every(({ bindings }) => Object.isFrozen(bindings))).toBe(
        true,
      )
      expect(
        groups.every(({ bindings }) =>
          bindings.every((binding) => Object.isFrozen(binding)),
        ),
      ).toBe(true)
    }
  })
})

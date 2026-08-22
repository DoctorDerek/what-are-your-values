import { PLAYER_DATA_RESET_KINDS } from "@game/machines/src/PlayerDataReset"
import { playerDataResetCopy } from "@game/machines/src/PlayerDataResetCopy"
import { SETTINGS_PLAYER_DATA_RESET_KINDS } from "@game/machines/src/PlayerSettingsPresentation"
import { describe, expect, it, jest } from "@jest/globals"
import { render, screen, userEvent } from "@testing-library/react-native"
import NativePlayerDataResetActions from "@/components/NativePlayerDataResetActions"

describe("NativePlayerDataResetActions", () => {
  it("preserves the complete default action catalog", async () => {
    await render(
      <NativePlayerDataResetActions
        customValueCount={2}
        isBusy={false}
        onRequestReset={jest.fn()}
      />,
    )

    for (const resetKind of PLAYER_DATA_RESET_KINDS) {
      expect(
        screen.getByRole("button", {
          name: playerDataResetCopy[resetKind].actionLabel,
        }),
      ).toBeEnabled()
    }
  })

  it("renders the exact caller-declared Settings subset and forwards its typed action", async () => {
    const onRequestReset = jest.fn()
    const user = userEvent.setup()
    await render(
      <NativePlayerDataResetActions
        customValueCount={2}
        isBusy={false}
        onRequestReset={onRequestReset}
        playerDataResetKinds={SETTINGS_PLAYER_DATA_RESET_KINDS}
      />,
    )

    expect(
      screen.queryByRole("button", { name: "Delete All Custom Values" }),
    ).not.toBeOnTheScreen()
    await user.press(screen.getByRole("button", { name: "Reset Achievements" }))
    expect(onRequestReset).toHaveBeenCalledWith("reset-achievements")
  })
})

import type { PreparedWayvmDownload } from "@game/machines/src/PlayerDataPortabilityActors"
import { playerDataPortabilityCopy } from "@game/machines/src/PlayerDataPortabilityCopy"
import { describe, expect, it, jest } from "@jest/globals"
import { act, renderHook, waitFor } from "@testing-library/react-native"
import useNativePlayerDataFiles from "@/components/useNativePlayerDataFiles"
import { expoPlayerDataFileAdapter } from "@/lib/ExpoPlayerDataFiles"

jest.mock("@/lib/ExpoPlayerDataFiles", () => ({
  expoPlayerDataFileAdapter: {
    exportJson: jest.fn(),
    selectJsonForImport: jest.fn(),
  },
}))

type HookProps = Parameters<typeof useNativePlayerDataFiles>[0]
type HookState = HookProps["state"]
type HookSend = HookProps["send"]
type ActiveScreen = "DataManagement" | "Hub" | "PersistenceFailure" | "Settings"

const preparedDownload = Object.freeze({
  filename: "wayvm-backup.json",
  serialized: '{"private":"backup"}',
}) satisfies PreparedWayvmDownload

function createState(
  activeScreen: ActiveScreen,
  download: PreparedWayvmDownload | null,
) {
  return {
    context: { preparedDownload: download },
    matches: (candidate: ActiveScreen) => candidate === activeScreen,
  } as unknown as HookState
}

function createSend() {
  return jest.fn() as jest.MockedFunction<HookSend>
}

const exportJson = jest.mocked(expoPlayerDataFileAdapter.exportJson)
const selectJsonForImport = jest.mocked(
  expoPlayerDataFileAdapter.selectJsonForImport,
)

describe("useNativePlayerDataFiles", () => {
  it.each(["DataManagement", "Settings"] as const)(
    "delivers one %s export and acknowledges the shared download once",
    async (activeScreen) => {
      exportJson.mockResolvedValue(undefined)
      const send = createSend()
      const { rerender } = await renderHook(useNativePlayerDataFiles, {
        initialProps: {
          state: createState(activeScreen, preparedDownload),
          send,
        },
      })

      await waitFor(() => expect(exportJson).toHaveBeenCalledTimes(1))
      await waitFor(() =>
        expect(send).toHaveBeenCalledWith({
          type: "DATA_MANAGEMENT.EXPORT_CONSUMED",
        }),
      )

      await rerender({
        state: createState(activeScreen, preparedDownload),
        send,
      })

      expect(exportJson).toHaveBeenCalledTimes(1)
    },
  )

  it("routes recovery export success and failure to recovery", async () => {
    exportJson
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Sharing failed"))
    const send = createSend()
    const { rerender } = await renderHook(useNativePlayerDataFiles, {
      initialProps: {
        state: createState("PersistenceFailure", preparedDownload),
        send,
      },
    })

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({ type: "RECOVERY.EXPORT_CONSUMED" }),
    )

    await rerender({
      state: createState("PersistenceFailure", {
        ...preparedDownload,
      }),
      send,
    })

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith({
        type: "RECOVERY.PLATFORM_FAILURE_REPORTED",
        issue: playerDataPortabilityCopy.exportFailure,
      }),
    )
  })

  it("ignores downloads outside data-control and recovery screens", async () => {
    const send = createSend()
    await renderHook(useNativePlayerDataFiles, {
      initialProps: {
        state: createState("Hub", preparedDownload),
        send,
      },
    })

    expect(exportJson).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it("reports picker progress and prepares a selected data-management backup", async () => {
    let resolveSelection: (serialized: string) => void = () => undefined
    selectJsonForImport.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveSelection = resolve
      }),
    )
    const send = createSend()
    const { result } = await renderHook(useNativePlayerDataFiles, {
      initialProps: {
        state: createState("DataManagement", null),
        send,
      },
    })

    let selection = Promise.resolve()
    await act(async () => {
      selection = result.current.chooseBackup("data-management")
      await Promise.resolve()
    })

    expect(result.current.isReadingImportFile).toBe(true)
    expect(send).toHaveBeenCalledWith({
      type: "DATA_MANAGEMENT.IMPORT_FILE_READ_REQUESTED",
    })

    await act(async () => {
      resolveSelection('{"schemaVersion":1}')
      await selection
    })

    expect(send).toHaveBeenCalledWith({
      type: "DATA_MANAGEMENT.IMPORT_PREPARE_REQUESTED",
      serialized: '{"schemaVersion":1}',
    })
    expect(result.current.isReadingImportFile).toBe(false)
  })

  it("leaves current data untouched when the picker is canceled", async () => {
    selectJsonForImport.mockResolvedValue(null)
    const send = createSend()
    const { result } = await renderHook(useNativePlayerDataFiles, {
      initialProps: {
        state: createState("DataManagement", null),
        send,
      },
    })

    await act(async () => {
      await result.current.chooseBackup("data-management")
    })

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith({
      type: "DATA_MANAGEMENT.IMPORT_FILE_READ_REQUESTED",
    })
    expect(result.current.isReadingImportFile).toBe(false)
  })

  it("prepares recovery backups without ordinary picker feedback", async () => {
    selectJsonForImport.mockResolvedValue("recovery-backup")
    const send = createSend()
    const { result } = await renderHook(useNativePlayerDataFiles, {
      initialProps: {
        state: createState("PersistenceFailure", null),
        send,
      },
    })

    await act(async () => {
      await result.current.chooseBackup("recovery")
    })

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith({
      type: "RECOVERY.IMPORT_PREPARE_REQUESTED",
      serialized: "recovery-backup",
    })
  })

  it("maps picker failures to the active destination and clears progress", async () => {
    selectJsonForImport.mockRejectedValue(new Error("Unreadable selection"))
    const send = createSend()
    const { result } = await renderHook(useNativePlayerDataFiles, {
      initialProps: {
        state: createState("DataManagement", null),
        send,
      },
    })

    await act(async () => {
      await result.current.chooseBackup("data-management")
    })

    expect(send).toHaveBeenLastCalledWith({
      type: "DATA_MANAGEMENT.PLATFORM_FAILURE_REPORTED",
      issue: playerDataPortabilityCopy.importInvalid,
    })
    expect(result.current.isReadingImportFile).toBe(false)
  })
})

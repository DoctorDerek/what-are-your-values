import { playerDataRecoveryCopy } from "@game/machines/src/PlayerDataRecoveryCopy"
import { View } from "react-native"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

type SharedRecoveryActions = {
  readonly isBusy: boolean
  readonly onTryAgain: () => void
}

type UnreadableDataRecoveryActions = SharedRecoveryActions & {
  readonly mode: "unreadable-data"
  readonly hasLastKnownGoodSave: boolean
  readonly onDeleteAllData: () => void
  readonly onExportUnreadableData: () => void
  readonly onImportBackup: () => void
  readonly onRestoreLastKnownGoodSave: () => void
}

type StorageUnavailableRecoveryActions = SharedRecoveryActions & {
  readonly mode: "storage-unavailable"
  readonly canExportCurrentData: boolean
  readonly canReturnWithoutNewChanges: boolean
  readonly onExportCurrentData: () => void
  readonly onReturnWithoutNewChanges: () => void
}

type NativePlayerDataRecoveryActionsProps =
  UnreadableDataRecoveryActions | StorageUnavailableRecoveryActions

export default function NativePlayerDataRecoveryActions(
  props: NativePlayerDataRecoveryActionsProps,
) {
  const { actions } = playerDataRecoveryCopy

  if (props.mode === "unreadable-data")
    return (
      <View className="gap-4">
        {props.hasLastKnownGoodSave ? (
          <Button
            disabled={props.isBusy}
            size="large"
            onPress={props.onRestoreLastKnownGoodSave}
          >
            <Text>{actions.restoreLastKnownGoodSave}</Text>
          </Button>
        ) : null}
        <Button
          disabled={props.isBusy}
          size="large"
          variant="secondary"
          onPress={props.onImportBackup}
        >
          <Text>{actions.importBackup}</Text>
        </Button>
        <Button
          disabled={props.isBusy}
          size="large"
          variant="outline"
          onPress={props.onExportUnreadableData}
        >
          <Text>{actions.exportUnreadableData}</Text>
        </Button>
        <Button
          disabled={props.isBusy}
          size="large"
          variant="outline"
          onPress={props.onTryAgain}
        >
          <Text>{actions.tryAgain}</Text>
        </Button>
        <Button
          disabled={props.isBusy}
          size="large"
          variant="destructive"
          onPress={props.onDeleteAllData}
        >
          <Text>{actions.deleteAllData}</Text>
        </Button>
      </View>
    )

  return (
    <View className="gap-4">
      {props.canExportCurrentData ? (
        <Button
          disabled={props.isBusy}
          size="large"
          variant="secondary"
          onPress={props.onExportCurrentData}
        >
          <Text>{actions.exportCurrentData}</Text>
        </Button>
      ) : null}
      <Button disabled={props.isBusy} size="large" onPress={props.onTryAgain}>
        <Text>{actions.tryAgain}</Text>
      </Button>
      {props.canReturnWithoutNewChanges ? (
        <Button
          disabled={props.isBusy}
          size="large"
          variant="outline"
          onPress={props.onReturnWithoutNewChanges}
        >
          <Text>{actions.returnWithoutNewChanges}</Text>
        </Button>
      ) : null}
    </View>
  )
}

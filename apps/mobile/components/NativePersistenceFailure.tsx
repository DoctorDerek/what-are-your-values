import { playerDataRecoveryCopy } from "@game/machines/src/PlayerDataRecoveryCopy"
import type { PlayerDataResetReview } from "@game/machines/src/PlayerDataReset"
import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { ScrollView, View } from "react-native"
import MapacheScreen from "@/components/MapacheScreen"
import NativeOperationMessages from "@/components/NativeOperationMessages"
import NativePlayerDataImportPreview from "@/components/NativePlayerDataImportPreview"
import NativePlayerDataRecoveryActions from "@/components/NativePlayerDataRecoveryActions"
import NativePlayerDataResetReview from "@/components/NativePlayerDataResetReview"
import { Text } from "@/components/ui/text"

export type NativePlayerDataRecoveryActivity =
  | "Checking backup…"
  | "Creating backup…"
  | "Creating diagnostic file…"
  | "Deleting data…"
  | "Restoring backup…"

type SharedNativePersistenceFailureProps = {
  readonly activity: NativePlayerDataRecoveryActivity | null
  readonly issue: string | null
  readonly notice: string | null
  readonly onTryAgain: () => void
}

type UnreadableDataFailureProps = SharedNativePersistenceFailureProps & {
  readonly mode: "unreadable-data"
  readonly hasLastKnownGoodSave: boolean
  readonly pendingImportSource: "last-known-good" | "selected-backup" | null
  readonly preview: WayvmImportPreview | null
  readonly resetReview: PlayerDataResetReview | null
  readonly onCancelImport: () => void
  readonly onCancelReset: () => void
  readonly onConfirmImport: () => void
  readonly onConfirmReset: (review: PlayerDataResetReview) => void
  readonly onDeleteAllData: () => void
  readonly onExportUnreadableData: () => void
  readonly onImportBackup: () => void
  readonly onRestoreLastKnownGoodSave: () => void
}

type StorageUnavailableFailureProps = SharedNativePersistenceFailureProps & {
  readonly mode: "storage-unavailable"
  readonly canExportCurrentData: boolean
  readonly canReturnWithoutNewChanges: boolean
  readonly onExportCurrentData: () => void
  readonly onReturnWithoutNewChanges: () => void
}

type NativePersistenceFailureProps =
  UnreadableDataFailureProps | StorageUnavailableFailureProps

export default function NativePersistenceFailure(
  props: NativePersistenceFailureProps,
) {
  const isBusy = props.activity !== null
  const title =
    props.mode === "unreadable-data"
      ? playerDataRecoveryCopy.unreadableData.title
      : playerDataRecoveryCopy.storageUnavailable.title
  const body =
    props.mode === "unreadable-data"
      ? playerDataRecoveryCopy.unreadableData.body
      : [playerDataRecoveryCopy.storageUnavailable.body]

  return (
    <MapacheScreen>
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow p-5 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <View
          accessibilityState={{ busy: isBusy }}
          className="m-auto w-full max-w-3xl border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000]"
        >
          <Text
            accessibilityRole="header"
            variant="h1"
            className="text-mapache-vivid-secondary-red text-4xl uppercase"
          >
            {title}
          </Text>
          <View className="mt-5 gap-4">
            {body.map((paragraph) => (
              <Text
                key={paragraph}
                className="text-lg leading-7 font-medium text-black"
              >
                {paragraph}
              </Text>
            ))}
          </View>

          <View className="mt-6 gap-5">
            <NativeOperationMessages
              activity={props.activity}
              issue={props.issue}
              notice={props.notice}
            />

            {props.mode === "unreadable-data" ? (
              props.resetReview ? (
                <NativePlayerDataResetReview
                  key={props.resetReview.confirmationId}
                  isBusy={isBusy}
                  review={props.resetReview}
                  onCancel={props.onCancelReset}
                  onConfirm={props.onConfirmReset}
                  onExport={props.onExportUnreadableData}
                />
              ) : props.preview ? (
                <NativePlayerDataImportPreview
                  confirmLabel={
                    props.pendingImportSource === "last-known-good"
                      ? playerDataRecoveryCopy.unreadableData
                          .restoreReviewAction
                      : playerDataRecoveryCopy.unreadableData
                          .selectedBackupReviewAction
                  }
                  isBusy={isBusy}
                  preview={props.preview}
                  title={
                    props.pendingImportSource === "last-known-good"
                      ? playerDataRecoveryCopy.unreadableData.restoreReviewTitle
                      : playerDataRecoveryCopy.unreadableData
                          .selectedBackupReviewTitle
                  }
                  warning={
                    props.pendingImportSource === "last-known-good"
                      ? playerDataRecoveryCopy.unreadableData
                          .restoreConfirmation
                      : playerDataRecoveryCopy.unreadableData
                          .selectedBackupConfirmation
                  }
                  onCancel={props.onCancelImport}
                  onConfirm={props.onConfirmImport}
                />
              ) : (
                <>
                  {!props.hasLastKnownGoodSave ? (
                    <Text
                      accessibilityRole="alert"
                      className="bg-mapache-vivid-secondary-gold border-4 border-black p-4 text-lg leading-7 font-black text-black"
                    >
                      {playerDataRecoveryCopy.unreadableData.noKnownGoodSave}
                    </Text>
                  ) : null}
                  <NativePlayerDataRecoveryActions
                    mode="unreadable-data"
                    hasLastKnownGoodSave={props.hasLastKnownGoodSave}
                    isBusy={isBusy}
                    onDeleteAllData={props.onDeleteAllData}
                    onExportUnreadableData={props.onExportUnreadableData}
                    onImportBackup={props.onImportBackup}
                    onRestoreLastKnownGoodSave={
                      props.onRestoreLastKnownGoodSave
                    }
                    onTryAgain={props.onTryAgain}
                  />
                </>
              )
            ) : (
              <NativePlayerDataRecoveryActions
                mode="storage-unavailable"
                canExportCurrentData={props.canExportCurrentData}
                canReturnWithoutNewChanges={props.canReturnWithoutNewChanges}
                isBusy={isBusy}
                onExportCurrentData={props.onExportCurrentData}
                onReturnWithoutNewChanges={props.onReturnWithoutNewChanges}
                onTryAgain={props.onTryAgain}
              />
            )}
          </View>
        </View>
      </ScrollView>
    </MapacheScreen>
  )
}

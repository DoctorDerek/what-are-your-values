import { PRODUCT_MENU_COPY } from "@game/data/src/ProductMenu"
import { playerDataPortabilityCopy } from "@game/machines/src/PlayerDataPortabilityCopy"
import type {
  PlayerDataResetKind,
  PlayerDataResetReview,
} from "@game/machines/src/PlayerDataReset"
import type { WayvmImportPreview } from "@game/machines/src/WayvmImportPreview"
import { ScrollView, View } from "react-native"
import MapacheScreen from "@/components/MapacheScreen"
import NativeOperationMessages from "@/components/NativeOperationMessages"
import NativePlayerDataImportPreview from "@/components/NativePlayerDataImportPreview"
import NativePlayerDataResetActions from "@/components/NativePlayerDataResetActions"
import NativePlayerDataResetReview from "@/components/NativePlayerDataResetReview"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

export type NativeDataManagementActivity =
  | "Creating backup…"
  | "Checking backup…"
  | "Creating safety backup…"
  | "Restoring backup…"
  | "Applying reset…"
  | "Deleting data…"

export default function NativeDataManagement({
  activity,
  customValueCount,
  isNavigationPending,
  issue,
  notice,
  preview,
  resetReview,
  onCancelImport,
  onCancelReset,
  onChooseBackup,
  onClose,
  onConfirmImport,
  onConfirmReset,
  onExport,
  onOpenMenu,
  onRequestReset,
}: {
  readonly activity: NativeDataManagementActivity | null
  readonly customValueCount: number
  readonly isNavigationPending: boolean
  readonly issue: string | null
  readonly notice: string | null
  readonly preview: WayvmImportPreview | null
  readonly resetReview: PlayerDataResetReview | null
  readonly onCancelImport: () => void
  readonly onCancelReset: () => void
  readonly onChooseBackup: () => void
  readonly onClose: () => void
  readonly onConfirmImport: () => void
  readonly onConfirmReset: (review: PlayerDataResetReview) => void
  readonly onExport: () => void
  readonly onOpenMenu: () => void
  readonly onRequestReset: (resetKind: PlayerDataResetKind) => void
}) {
  const isBusy = activity !== null
  const isNavigationBlocked =
    isNavigationPending || isBusy || preview !== null || resetReview !== null

  return (
    <MapacheScreen>
      <View className="gap-4 border-b-4 border-black p-4">
        <Text
          variant="h1"
          className="text-mapache-vivid-primary-cyan text-left text-4xl uppercase"
        >
          {playerDataPortabilityCopy.screenTitle}
        </Text>
        <View className="flex-row gap-3">
          <Button
            className="flex-1"
            disabled={isNavigationBlocked}
            variant="outline"
            onPress={onOpenMenu}
          >
            <Text>{PRODUCT_MENU_COPY.openAction}</Text>
          </Button>
          <Button
            className="flex-1"
            disabled={isNavigationBlocked}
            variant="secondary"
            onPress={onClose}
          >
            <Text>Back to Your Values</Text>
          </Button>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 p-5 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <View accessibilityState={{ busy: isBusy }} className="gap-5">
          <Text className="text-lg leading-7 font-bold text-white">
            {playerDataPortabilityCopy.introduction}
          </Text>

          <NativeOperationMessages
            activity={activity}
            issue={issue}
            notice={notice}
          />

          {resetReview ? (
            <NativePlayerDataResetReview
              key={resetReview.confirmationId}
              isBusy={isBusy}
              review={resetReview}
              onCancel={onCancelReset}
              onConfirm={onConfirmReset}
              onExport={onExport}
            />
          ) : preview ? (
            <NativePlayerDataImportPreview
              isBusy={isBusy}
              preview={preview}
              onCancel={onCancelImport}
              onConfirm={onConfirmImport}
            />
          ) : (
            <>
              <View className="gap-4 border-4 border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000000]">
                <Text
                  accessibilityRole="header"
                  className="border-b-4 border-black pb-3 text-3xl font-black text-black uppercase"
                >
                  {playerDataPortabilityCopy.exportTitle}
                </Text>
                <Text className="text-lg leading-7 font-bold text-black">
                  {playerDataPortabilityCopy.exportDescription}
                </Text>
                <Button disabled={isBusy} onPress={onExport}>
                  <Text>{playerDataPortabilityCopy.exportAction}</Text>
                </Button>
              </View>

              <View className="gap-4 border-4 border-black bg-white p-5 shadow-[6px_6px_0px_0px_#000000]">
                <Text
                  accessibilityRole="header"
                  className="border-b-4 border-black pb-3 text-3xl font-black text-black uppercase"
                >
                  {playerDataPortabilityCopy.importTitle}
                </Text>
                <Text className="text-lg leading-7 font-bold text-black">
                  {playerDataPortabilityCopy.importDescription}
                </Text>
                <Button
                  disabled={isBusy}
                  variant="secondary"
                  onPress={onChooseBackup}
                >
                  <Text>{playerDataPortabilityCopy.chooseBackupAction}</Text>
                </Button>
              </View>

              <NativePlayerDataResetActions
                customValueCount={customValueCount}
                isBusy={isBusy}
                onRequestReset={onRequestReset}
              />
            </>
          )}
        </View>
      </ScrollView>
    </MapacheScreen>
  )
}

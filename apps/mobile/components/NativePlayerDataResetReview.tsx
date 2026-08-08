import {
  DELETE_ALL_DATA_ACKNOWLEDGMENT,
  type PlayerDataResetReview,
} from "@game/machines/src/PlayerDataReset"
import { playerDataResetCopy } from "@game/machines/src/PlayerDataResetCopy"
import { useState } from "react"
import { Switch, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

export default function NativePlayerDataResetReview({
  isBusy,
  review,
  onCancel,
  onConfirm,
  onExport,
}: {
  readonly isBusy: boolean
  readonly review: PlayerDataResetReview
  readonly onCancel: () => void
  readonly onConfirm: (review: PlayerDataResetReview) => void
  readonly onExport: () => void
}) {
  const [acknowledgedCompleteErasure, setAcknowledgedCompleteErasure] =
    useState(false)
  const copy = playerDataResetCopy[review.resetKind]
  const requiresCompleteErasureAcknowledgment =
    review.resetKind === "delete-all-data"

  return (
    <View className="border-mapache-vivid-primary-orange gap-5 border-8 bg-white p-5 shadow-[8px_8px_0px_0px_#000000]">
      <Text
        variant="h2"
        className="border-b-4 border-black text-black uppercase"
      >
        {copy.confirmationTitle}
      </Text>

      <View className="gap-4">
        {copy.confirmationBody.map((paragraph) => (
          <Text
            key={paragraph}
            className="text-lg leading-7 font-bold text-black"
          >
            {paragraph}
          </Text>
        ))}
      </View>

      {requiresCompleteErasureAcknowledgment ? (
        <View className="bg-mapache-vivid-light flex-row items-center gap-4 border-4 border-black p-4">
          <Switch
            accessibilityLabel={DELETE_ALL_DATA_ACKNOWLEDGMENT}
            disabled={isBusy}
            onValueChange={setAcknowledgedCompleteErasure}
            value={acknowledgedCompleteErasure}
          />
          <Text className="min-w-0 flex-1 text-lg leading-7 font-black text-black">
            {DELETE_ALL_DATA_ACKNOWLEDGMENT}
          </Text>
        </View>
      ) : null}

      <View className="gap-4">
        <Button disabled={isBusy} variant="secondary" onPress={onExport}>
          <Text>Export Data</Text>
        </Button>
        <Button disabled={isBusy} variant="outline" onPress={onCancel}>
          <Text>Cancel</Text>
        </Button>
        <Button
          disabled={
            isBusy ||
            (requiresCompleteErasureAcknowledgment &&
              !acknowledgedCompleteErasure)
          }
          variant="destructive"
          onPress={() => onConfirm(review)}
        >
          <Text>{copy.actionLabel}</Text>
        </Button>
      </View>
    </View>
  )
}

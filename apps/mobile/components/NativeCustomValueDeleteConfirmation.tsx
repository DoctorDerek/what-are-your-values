import { View } from "react-native"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

export default function NativeCustomValueDeleteConfirmation({
  displayName,
  isPersistencePending,
  onCancel,
  onConfirm,
}: {
  readonly displayName: string
  readonly isPersistencePending: boolean
  readonly onCancel: () => void
  readonly onConfirm: () => void
}) {
  return (
    <View
      accessibilityLabel={`Remove ${displayName}?`}
      accessibilityRole="alert"
      className="border-mapache-vivid-secondary-red gap-4 border-4 bg-white p-4"
    >
      <Text
        accessibilityRole="header"
        className="text-2xl font-black text-black uppercase"
      >
        Remove {displayName}?
      </Text>
      <Text className="text-base leading-6 font-bold text-black">
        Removing this Custom Value permanently deletes its name, definition, and
        progress record. Every retained value keeps its levels and experience.
        Your revised cycle starts with Undo and Redo cleared.
      </Text>
      <View className="flex-row gap-3">
        <Button
          className="min-w-0 flex-1"
          disabled={isPersistencePending}
          variant="secondary"
          onPress={onCancel}
        >
          <Text>Cancel</Text>
        </Button>
        <Button
          className="min-w-0 flex-1"
          disabled={isPersistencePending}
          variant="destructive"
          onPress={onConfirm}
        >
          <Text>{isPersistencePending ? "Deleting…" : "Remove Value"}</Text>
        </Button>
      </View>
    </View>
  )
}

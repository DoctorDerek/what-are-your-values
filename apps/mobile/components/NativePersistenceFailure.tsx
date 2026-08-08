import { playerDataRecoveryCopy } from "@game/machines/src/PlayerDataRecoveryCopy"
import { ScrollView, View } from "react-native"
import MapacheScreen from "@/components/MapacheScreen"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

export default function NativePersistenceFailure({
  hasRecoveryEntries,
  canReturnWithoutNewChanges,
  issue,
  onTryAgain,
  onReturnWithoutNewChanges,
}: {
  hasRecoveryEntries: boolean
  canReturnWithoutNewChanges: boolean
  issue: string | null
  onTryAgain: () => void
  onReturnWithoutNewChanges: () => void
}) {
  const title = hasRecoveryEntries
    ? playerDataRecoveryCopy.unreadableData.title
    : playerDataRecoveryCopy.storageUnavailable.title
  const body = hasRecoveryEntries
    ? playerDataRecoveryCopy.unreadableData.body
    : [playerDataRecoveryCopy.storageUnavailable.body]

  return (
    <MapacheScreen>
      <ScrollView className="flex-1" contentContainerClassName="grow p-5">
        <View
          accessibilityLiveRegion="assertive"
          className="m-auto w-full max-w-3xl border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000]"
        >
          <Text
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
            {issue ? (
              <Text className="border-4 border-black bg-white p-3 text-base font-black text-black">
                {issue}
              </Text>
            ) : null}
          </View>
          <View className="mt-6 gap-4">
            <Button size="large" onPress={onTryAgain}>
              <Text>{playerDataRecoveryCopy.actions.tryAgain}</Text>
            </Button>
            {canReturnWithoutNewChanges ? (
              <Button
                size="large"
                variant="outline"
                onPress={onReturnWithoutNewChanges}
              >
                <Text>
                  {playerDataRecoveryCopy.actions.returnWithoutNewChanges}
                </Text>
              </Button>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </MapacheScreen>
  )
}

import { playerDataRecoveryCopy } from "@game/machines/src/PlayerDataRecoveryCopy"
import MapacheScreen from "@/components/MapacheScreen"
import { Text } from "@/components/ui/text"

export default function NativePlayerDataLoading() {
  return (
    <MapacheScreen
      accessibilityLabel="Loading player data"
      accessibilityLiveRegion="polite"
      className="items-center justify-center px-6"
    >
      <Text
        variant="h1"
        className="text-mapache-vivid-primary-cyan text-4xl uppercase"
      >
        {playerDataRecoveryCopy.loading}
      </Text>
    </MapacheScreen>
  )
}

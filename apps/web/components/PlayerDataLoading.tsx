import { playerDataRecoveryCopy } from "@game/machines/src/PlayerDataRecoveryCopy"
import MapacheScreen from "@/components/MapacheScreen"

export default function PlayerDataLoading() {
  return (
    <MapacheScreen
      aria-busy="true"
      spacing="standard"
      viewport="scrollable"
      className="flex items-center justify-center text-center"
    >
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-mapache-vivid-primary-cyan text-4xl font-black uppercase drop-shadow-[4px_4px_0px_#000000] sm:text-6xl"
      >
        {playerDataRecoveryCopy.loading}
      </p>
    </MapacheScreen>
  )
}

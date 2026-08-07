import { playerDataRecoveryCopy } from "@game/machines/src/PlayerDataRecoveryCopy"

export default function PlayerDataLoading() {
  return (
    <main
      aria-busy="true"
      className="noise-bg bg-mapache-vivid-dark flex min-h-[100dvh] w-full items-center justify-center p-4 text-center sm:p-8"
    >
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-mapache-vivid-primary-cyan text-4xl font-black uppercase drop-shadow-[4px_4px_0px_#000000] sm:text-6xl"
      >
        {playerDataRecoveryCopy.loading}
      </p>
    </main>
  )
}

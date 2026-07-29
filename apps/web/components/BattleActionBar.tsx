export default function BattleActionBar({
  canUndo,
  canRedo,
  canStop,
  onUndo,
  onRedo,
  onStop,
}: {
  canUndo: boolean
  canRedo: boolean
  canStop: boolean
  onUndo: () => void
  onRedo: () => void
  onStop: () => void
}) {
  const historyActionClasses =
    "cursor-pointer border-4 border-black bg-white px-2 py-2 text-sm font-black text-black uppercase shadow-[4px_4px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_0px_#000000] sm:px-5 sm:py-3 sm:text-xl"

  return (
    <nav
      aria-label="Battle actions"
      className="absolute top-3 left-1/2 z-50 grid w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 grid-cols-3 gap-2 sm:top-6 sm:gap-4"
    >
      <button
        type="button"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={onUndo}
        className={historyActionClasses}
      >
        Undo{" "}
        <span aria-hidden="true" className="hidden sm:inline">
          [Z]
        </span>
      </button>
      <button
        type="button"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={onRedo}
        className={historyActionClasses}
      >
        Redo{" "}
        <span aria-hidden="true" className="hidden sm:inline">
          [Y]
        </span>
      </button>
      <button
        type="button"
        aria-label="Stop"
        disabled={!canStop}
        onClick={onStop}
        className="bg-mapache-vivid-secondary-red cursor-pointer border-4 border-black px-2 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_0px_#000000] sm:px-5 sm:py-3 sm:text-xl"
      >
        Stop{" "}
        <span aria-hidden="true" className="hidden sm:inline">
          [ESC]
        </span>
      </button>
    </nav>
  )
}

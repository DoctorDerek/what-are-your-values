export default function BattleActionBar({
  canOpenMenu,
  canUndo,
  canRedo,
  canStop,
  showKeyboardControlHints,
  onOpenMenu,
  onUndo,
  onRedo,
  onStop,
}: {
  canOpenMenu: boolean
  canUndo: boolean
  canRedo: boolean
  canStop: boolean
  showKeyboardControlHints: boolean
  onOpenMenu: () => void
  onUndo: () => void
  onRedo: () => void
  onStop: () => void
}) {
  const historyActionClasses =
    "cursor-pointer border-4 border-black bg-white px-2 py-2 text-sm font-black text-black uppercase shadow-[4px_4px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_0px_#000000] xl:px-5 xl:py-3 xl:text-xl"
  const keyboardControlHintClasses = showKeyboardControlHints
    ? "hidden xl:inline"
    : "hidden xl:invisible xl:inline"

  return (
    <nav
      aria-label="Battle actions"
      className="pointer-events-auto relative z-50 mx-auto grid w-full max-w-3xl shrink-0 grid-cols-4 gap-2 p-3 xl:gap-4 xl:p-6"
    >
      <button
        type="button"
        aria-label="Menu"
        disabled={!canOpenMenu}
        onClick={onOpenMenu}
        className={historyActionClasses}
      >
        Menu{" "}
        <span aria-hidden="true" className={keyboardControlHintClasses}>
          [ESC]
        </span>
      </button>
      <button
        type="button"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={onUndo}
        className={historyActionClasses}
      >
        Undo{" "}
        <span aria-hidden="true" className={keyboardControlHintClasses}>
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
        <span aria-hidden="true" className={keyboardControlHintClasses}>
          [Y]
        </span>
      </button>
      <button
        type="button"
        aria-label="Stop"
        disabled={!canStop}
        onClick={onStop}
        className="bg-mapache-vivid-secondary-red cursor-pointer border-4 border-black px-2 py-2 text-sm font-black text-black uppercase shadow-[4px_4px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:translate-x-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_0px_#000000] xl:px-5 xl:py-3 xl:text-xl"
      >
        Stop
      </button>
    </nav>
  )
}

"use client"

import {
  getValueDisplayDefinition,
  getValueDisplayName,
  type ActiveValueDefinition,
  type ValueId,
} from "@game/data/src/Value"
import { getValueChoiceAccessibilityLabel } from "@game/machines/src/BattleAccessibilityPresentation"
import type { BattleRewardPresentation } from "@game/machines/src/BattleRewardPresentation"
import {
  forwardRef,
  useId,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"

export type ValueChoicePosition = "first" | "second"

type ValueChoiceCardProps = {
  position: ValueChoicePosition
  value: ActiveValueDefinition
  level: number
  focusedId: ValueId | null
  winnerId: ValueId | null
  isEnabled: boolean
  isAnimating: boolean
  controlHint: string | null
  combatant?: (isAttended: boolean, reward?: ReactNode) => ReactNode
  reward?: BattleRewardPresentation | null
  onActivate: (valueId: ValueId) => void
  onFocus: (valueId: ValueId) => void
}

export const ValueChoiceCard = forwardRef<
  HTMLButtonElement,
  ValueChoiceCardProps
>(function ValueChoiceCard(
  {
    position,
    value,
    level,
    focusedId,
    winnerId,
    isEnabled,
    isAnimating,
    controlHint,
    combatant,
    reward,
    onActivate,
    onFocus,
  },
  ref,
) {
  const isFirst = position === "first"
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const displayName = getValueDisplayName(value)
  const isWinner = isAnimating && winnerId === value.id
  const positionClasses = isFirst
    ? "bg-mapache-vivid-primary-cyan border-b-8 border-black xl:border-r-8 xl:border-b-0"
    : "bg-mapache-vivid-primary-raspberry"
  const controlHintContrastClasses = isFirst
    ? "text-black drop-shadow-[1px_1px_0px_#ffffff]"
    : "text-white drop-shadow-[1px_1px_0px_#000000]"
  const reservedControlHint = isFirst ? "[1 / A]" : "[2 / D]"
  const accessibleDefinitionId = useId()
  const rewardStyle: CSSProperties & { "--reward-progress": string } = {
    "--reward-progress": `${reward?.progressPercentage ?? 0}%`,
  }

  return (
    <div
      data-value-card={value.id}
      onFocus={() => {
        setIsFocused(true)
        onFocus(value.id)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setIsFocused(false)
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") setIsHovered(true)
      }}
      onPointerLeave={() => setIsHovered(false)}
      onPointerCancel={() => setIsHovered(false)}
      className={`${positionClasses} relative flex min-h-0 min-w-0 flex-1 flex-col items-center focus-within:ring-8 focus-within:ring-white focus-within:ring-inset ${isWinner ? "z-10" : ""} ${focusedId === value.id || isWinner ? "ring-8 ring-white ring-inset" : ""}`}
    >
      <div
        role="region"
        aria-label={displayName}
        tabIndex={0}
        onKeyDown={(event) => {
          if (
            event.target === event.currentTarget &&
            (event.key === " " ||
              event.key === "Enter" ||
              event.key.startsWith("Arrow"))
          )
            event.stopPropagation()
        }}
        className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overscroll-contain outline-none"
      >
        <button
          ref={ref}
          type="button"
          aria-label={getValueChoiceAccessibilityLabel({
            position,
            value,
            level,
          })}
          aria-describedby={accessibleDefinitionId}
          disabled={!isEnabled}
          onClick={() => onActivate(value.id)}
          className="flex min-h-full w-full min-w-0 cursor-pointer flex-col justify-start px-3 py-2 text-center outline-none after:absolute after:inset-0 disabled:cursor-default xl:px-8 xl:py-8"
        >
          <div className="my-auto w-full">
            <div className="grid w-full min-w-0 grid-cols-[1fr_auto] items-center gap-2 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:gap-5">
              <span
                aria-hidden="true"
                className={`w-16 justify-self-start text-center text-sm font-black whitespace-nowrap uppercase xl:w-28 xl:text-2xl ${controlHintContrastClasses} ${controlHint ? "" : "invisible"}`}
              >
                {controlHint ?? reservedControlHint}
              </span>
              <h2 className="col-span-2 row-start-1 mx-auto w-full max-w-4xl min-w-0 text-[clamp(1rem,min(5vw,5cqh),2.5rem)] leading-tight font-black [overflow-wrap:anywhere] break-words text-white uppercase drop-shadow-[4px_4px_0px_#000000] xl:col-span-1 xl:col-start-2 xl:text-[clamp(2rem,3.25vw,4rem)] xl:drop-shadow-[6px_6px_0px_#000000]">
                {displayName}
              </h2>
              <span className="inline-block border-2 border-black bg-white px-2 py-1 text-sm font-black whitespace-nowrap text-black uppercase shadow-[3px_3px_0px_0px_#000000] xl:border-4 xl:px-4 xl:py-2 xl:text-2xl xl:shadow-[6px_6px_0px_0px_#000000]">
                LVL {level}
              </span>
            </div>
            <p
              id={accessibleDefinitionId}
              className="mx-auto mt-3 max-w-2xl border-2 border-white/20 bg-black/40 p-3 text-[clamp(1rem,2.8vw,1.5rem)] leading-snug font-bold [overflow-wrap:anywhere] break-words whitespace-pre-wrap text-white drop-shadow-[2px_2px_0px_#000000] xl:mt-6 xl:p-6 xl:text-[clamp(1.25rem,2vw,1.875rem)] xl:leading-relaxed"
            >
              “{getValueDisplayDefinition(value)}”
            </p>
          </div>
        </button>
      </div>
      {combatant ? (
        <span
          className={`pointer-events-none relative flex w-full shrink-0 items-end px-[calc((100%-var(--battle-combatant-size)*2)/4)] pb-2 xl:px-4 ${isFirst ? "justify-start xl:justify-end" : "order-first justify-end xl:order-none xl:justify-start"}`}
        >
          <span className="flex w-(--battle-combatant-size) flex-col items-center">
            <span aria-hidden="true" className="block h-6 w-full xl:h-10" />
            {combatant(
              isEnabled && (isHovered || isFocused),
              reward ? (
                <span
                  className="block border-2 border-black bg-white px-1 text-center text-xs leading-4 font-black whitespace-nowrap text-black xl:text-base"
                  title={reward.progressLabel}
                >
                  {reward.label}
                  <span className="block h-1 overflow-hidden bg-black/15">
                    <span
                      className="bg-mapache-vivid-primary-raspberry block h-full w-(--reward-progress)"
                      style={rewardStyle}
                    />
                  </span>
                </span>
              ) : null,
            )}
          </span>
        </span>
      ) : null}
    </div>
  )
})

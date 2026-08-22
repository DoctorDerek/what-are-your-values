"use client"

import { PRODUCT_MENU_COPY } from "@game/data/src/ProductMenu"
import type {
  PlayerDataResetKind,
  PlayerDataResetReview as PlayerDataResetReviewState,
} from "@game/machines/src/PlayerDataReset"
import {
  createPlayerSettings,
  type PlayerSettings,
} from "@game/machines/src/PlayerSettings"
import {
  CONTROL_HINT_SETTING_OPTIONS,
  PLAYER_SETTINGS_COPY,
  PLAYER_SETTINGS_LANGUAGE_OPTIONS,
  REDUCED_MOTION_SETTING_OPTIONS,
  SETTINGS_PLAYER_DATA_RESET_KINDS,
} from "@game/machines/src/PlayerSettingsPresentation"
import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import PlayerDataResetActions from "./PlayerDataResetActions"
import PlayerDataResetReview from "./PlayerDataResetReview"

type SettingsOption<TValue extends string> = {
  readonly value: TValue
  readonly label: string
  readonly description: string
}

function SettingsRadioGroup<TValue extends string>({
  disabled,
  groupName,
  heading,
  options,
  selectedValue,
  onValueChange,
}: Readonly<{
  disabled: boolean
  groupName: string
  heading: string
  options: readonly SettingsOption<TValue>[]
  selectedValue: TValue
  onValueChange: (value: TValue) => void
}>) {
  return (
    <fieldset
      disabled={disabled}
      className="text-mapache-vivid-dark border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] xl:p-8"
    >
      <legend className="w-full border-b-4 border-black pb-4 text-3xl font-black uppercase xl:text-4xl">
        {heading}
      </legend>
      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {options.map((option) => {
          const isSelected = option.value === selectedValue
          const descriptionId = `${groupName}-${option.value}-description`

          return (
            <label
              key={option.value}
              className={cn(
                "flex min-w-0 cursor-pointer items-start gap-4 border-4 border-black p-4 shadow-[5px_5px_0px_0px_#000000]",
                isSelected ? "bg-mapache-vivid-primary-cyan" : "bg-white",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={isSelected}
                aria-describedby={descriptionId}
                onChange={() => onValueChange(option.value)}
                className="mt-1 size-6 shrink-0 accent-black"
              />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-xl font-black [overflow-wrap:anywhere] uppercase">
                    {option.label}
                  </span>
                  {isSelected ? (
                    <span className="shrink-0 border-2 border-black bg-black px-2 py-1 text-sm font-black text-white uppercase">
                      Selected
                    </span>
                  ) : null}
                </span>
                <span
                  id={descriptionId}
                  className="mt-2 block text-base leading-relaxed font-bold [overflow-wrap:anywhere]"
                >
                  {option.description}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export default function Settings({
  activity,
  customValueCount,
  issue,
  notice,
  resetReview,
  settings,
  onCancelReset,
  onClose,
  onConfirmReset,
  onExport,
  onOpenMenu,
  onRequestReset,
  onUpdateSettings,
}: Readonly<{
  activity: string | null
  customValueCount: number
  issue: string | null
  notice: string | null
  resetReview: PlayerDataResetReviewState | null
  settings: PlayerSettings
  onCancelReset: () => void
  onClose: () => void
  onConfirmReset: (review: PlayerDataResetReviewState) => void
  onExport: () => void
  onOpenMenu: () => void
  onRequestReset: (resetKind: PlayerDataResetKind) => void
  onUpdateSettings: (settings: PlayerSettings) => void
}>) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const issueRef = useRef<HTMLParagraphElement>(null)
  const resetActionFocusTargetIdRef = useRef<string | null>(null)
  const previousResetReviewRef = useRef(resetReview)
  const isBusy = activity !== null
  const isNavigationBlocked = isBusy || resetReview !== null

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  useEffect(() => {
    issueRef.current?.focus()
  }, [issue])

  useEffect(() => {
    if (
      previousResetReviewRef.current &&
      !resetReview &&
      resetActionFocusTargetIdRef.current
    ) {
      document.getElementById(resetActionFocusTargetIdRef.current)?.focus()
    }

    previousResetReviewRef.current = resetReview
  }, [resetReview])

  const handleRequestReset = (
    resetKind: PlayerDataResetKind,
    focusTargetId: string,
  ) => {
    resetActionFocusTargetIdRef.current = focusTargetId
    onRequestReset(resetKind)
  }

  return (
    <main className="noise-bg bg-mapache-vivid-dark flex h-[100dvh] w-full flex-col overflow-hidden p-4 xl:p-8">
      <header className="mx-auto flex w-full max-w-5xl shrink-0 flex-col items-stretch gap-4 xl:flex-row xl:items-center xl:justify-between">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-mapache-vivid-primary-cyan text-4xl font-black [overflow-wrap:anywhere] uppercase drop-shadow-[5px_5px_0px_#000000] outline-none xl:text-6xl"
        >
          {PLAYER_SETTINGS_COPY.title}
        </h1>
        <nav aria-label="Settings actions" className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={isNavigationBlocked}
            onClick={onOpenMenu}
            className="flex-1 whitespace-normal"
          >
            {PRODUCT_MENU_COPY.openAction}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isNavigationBlocked}
            onClick={onClose}
            className="flex-1 whitespace-normal"
          >
            {PLAYER_SETTINGS_COPY.closeAction}
          </Button>
        </nav>
      </header>

      <div
        aria-busy={isBusy}
        className="mx-auto mt-6 min-h-0 w-full max-w-5xl flex-1 overflow-y-auto overscroll-contain p-1 pr-3 pb-12"
      >
        <div className="flex flex-col gap-6">
          {activity ? (
            <p
              role="status"
              className="bg-mapache-vivid-primary-cyan text-mapache-vivid-dark border-4 border-black p-4 text-xl font-black uppercase shadow-[6px_6px_0px_0px_#000000]"
            >
              {activity}
            </p>
          ) : null}
          {notice ? (
            <p
              role="status"
              className="bg-mapache-vivid-secondary-green text-mapache-vivid-dark border-4 border-black p-4 text-xl font-black shadow-[6px_6px_0px_0px_#000000]"
            >
              {notice}
            </p>
          ) : null}
          {issue ? (
            <p
              ref={issueRef}
              role="alert"
              tabIndex={-1}
              className="bg-mapache-vivid-primary-orange border-4 border-black p-4 text-xl font-black text-white shadow-[6px_6px_0px_0px_#000000] outline-none"
            >
              {issue}
            </p>
          ) : null}

          {resetReview ? (
            <PlayerDataResetReview
              key={resetReview.confirmationId}
              isBusy={isBusy}
              review={resetReview}
              onCancel={onCancelReset}
              onConfirm={onConfirmReset}
              onExport={onExport}
            />
          ) : (
            <>
              <section
                aria-labelledby="settings-language-heading"
                className="text-mapache-vivid-dark border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] xl:p-8"
              >
                <h2
                  id="settings-language-heading"
                  className="border-b-4 border-black pb-4 text-3xl font-black uppercase xl:text-4xl"
                >
                  {PLAYER_SETTINGS_COPY.languageHeading}
                </h2>
                <div className="bg-mapache-vivid-primary-cyan mt-5 flex min-w-0 flex-wrap items-center justify-between gap-3 border-4 border-black p-4 shadow-[5px_5px_0px_0px_#000000]">
                  <p className="text-xl font-black [overflow-wrap:anywhere] uppercase">
                    {PLAYER_SETTINGS_LANGUAGE_OPTIONS[0].label}
                  </p>
                  <span className="shrink-0 border-2 border-black bg-black px-2 py-1 text-sm font-black text-white uppercase">
                    Current
                  </span>
                </div>
              </section>

              <SettingsRadioGroup
                disabled={isBusy}
                groupName="reduced-motion-setting"
                heading={PLAYER_SETTINGS_COPY.reducedMotionHeading}
                options={REDUCED_MOTION_SETTING_OPTIONS}
                selectedValue={settings.reducedMotion}
                onValueChange={(reducedMotion) =>
                  onUpdateSettings(
                    createPlayerSettings({ ...settings, reducedMotion }),
                  )
                }
              />

              <SettingsRadioGroup
                disabled={isBusy}
                groupName="control-hints-setting"
                heading={PLAYER_SETTINGS_COPY.controlHintsHeading}
                options={CONTROL_HINT_SETTING_OPTIONS}
                selectedValue={settings.controlHints}
                onValueChange={(controlHints) =>
                  onUpdateSettings(
                    createPlayerSettings({ ...settings, controlHints }),
                  )
                }
              />

              <PlayerDataResetActions
                customValueCount={customValueCount}
                isBusy={isBusy}
                playerDataResetKinds={SETTINGS_PLAYER_DATA_RESET_KINDS}
                onRequestReset={handleRequestReset}
              />
            </>
          )}
        </div>
      </div>
    </main>
  )
}

"use client"

import type { ComponentProps, ReactNode } from "react"
import { useId } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type InformationPanelFrameProps = Readonly<{
  title: string
  children: ReactNode
  primaryActionLabel: string
  onPrimaryAction: () => void
  accessibleCloseLabel?: string
  dialogTitle?: boolean
}>

function InformationPanelFrame({
  title,
  children,
  primaryActionLabel,
  onPrimaryAction,
  accessibleCloseLabel,
  dialogTitle = false,
}: InformationPanelFrameProps) {
  const titleId = useId()
  const titleClassName = cn(
    "text-mapache-vivid-primary-cyan text-4xl leading-tight font-black [overflow-wrap:anywhere] uppercase sm:text-5xl lg:text-7xl",
    accessibleCloseLabel && "px-12",
  )

  return (
    <section
      aria-label={dialogTitle ? title : undefined}
      aria-labelledby={dialogTitle ? undefined : titleId}
      className="grid min-h-0 w-full max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden border-4 border-black bg-white shadow-[12px_12px_0px_0px_#000000]"
    >
      <header className="relative border-b-4 border-black px-5 py-5 sm:px-10 sm:py-7">
        {dialogTitle ? (
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
        ) : (
          <h1 id={titleId} className={titleClassName}>
            {title}
          </h1>
        )}
        {accessibleCloseLabel ? (
          <Button
            aria-label={accessibleCloseLabel}
            type="button"
            variant="outline"
            size="icon"
            className="absolute top-4 right-4 text-3xl leading-none"
            onClick={onPrimaryAction}
          >
            ×
          </Button>
        ) : null}
      </header>

      <div
        data-testid="information-panel-body"
        className="min-h-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-10 sm:py-8"
      >
        {children}
      </div>

      <footer className="border-t-4 border-black bg-white px-5 py-5 sm:px-10 sm:py-6">
        <Button
          type="button"
          size="lg"
          onClick={onPrimaryAction}
          className="w-full text-4xl sm:text-5xl"
        >
          {primaryActionLabel}
        </Button>
      </footer>
    </section>
  )
}

export default function InformationPanel(props: InformationPanelFrameProps) {
  return (
    <main className="noise-bg bg-mapache-vivid-dark flex h-[100dvh] w-full items-stretch justify-center overflow-hidden p-4 text-center sm:p-6">
      <InformationPanelFrame {...props} />
    </main>
  )
}

export function ReopenedInformationPanel({
  open,
  onOpenChange,
  onCloseAutoFocus,
  ...frameProps
}: InformationPanelFrameProps &
  Readonly<{
    open: boolean
    onOpenChange: (open: boolean) => void
    onCloseAutoFocus?: ComponentProps<typeof DialogContent>["onCloseAutoFocus"]
  }>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="h-[calc(100dvh-2rem)] max-w-4xl grid-cols-1 grid-rows-1 border-0 bg-transparent p-0 shadow-none xl:max-w-4xl"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <InformationPanelFrame {...frameProps} dialogTitle />
      </DialogContent>
    </Dialog>
  )
}

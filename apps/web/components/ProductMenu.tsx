"use client"

import {
  PRODUCT_MENU_COPY,
  PRODUCT_MENU_DESTINATIONS,
  type ProductMenuDestination,
} from "@game/data/src/ProductMenu"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

export default function ProductMenu({
  contextActionLabel,
  open,
  onDestinationSelect,
  onOpenChange,
}: {
  contextActionLabel:
    | typeof PRODUCT_MENU_COPY.closeAction
    | typeof PRODUCT_MENU_COPY.resumeBattleAction
  open: boolean
  onDestinationSelect: (destination: ProductMenuDestination) => void
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="grid-rows-[auto_auto_minmax(0,1fr)]"
      >
        <header className="border-b-4 border-black px-5 py-5 xl:px-8 xl:py-7">
          <DialogTitle>{PRODUCT_MENU_COPY.title}</DialogTitle>
        </header>

        <div className="border-b-4 border-black p-5 xl:p-8">
          <Button
            type="button"
            size="lg"
            className="w-full text-xl xl:text-2xl"
            onClick={() => onOpenChange(false)}
          >
            {contextActionLabel}
          </Button>
        </div>

        <nav
          aria-label={PRODUCT_MENU_COPY.title}
          className="min-h-0 overflow-y-auto overscroll-contain p-5 xl:p-8"
        >
          <ul className="grid gap-4">
            {PRODUCT_MENU_DESTINATIONS.map((destination) => (
              <li key={destination.id}>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full justify-start text-left text-xl whitespace-normal xl:text-2xl"
                  onClick={() => onDestinationSelect(destination)}
                >
                  {destination.label}
                </Button>
              </li>
            ))}
          </ul>
        </nav>
      </DialogContent>
    </Dialog>
  )
}

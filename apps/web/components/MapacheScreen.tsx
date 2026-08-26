import { cva, type VariantProps } from "class-variance-authority"
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

const mapacheScreenVariants = cva(
  "noise-bg bg-mapache-vivid-dark w-full pt-[max(var(--mapache-screen-spacing),env(safe-area-inset-top,0px))] pr-[max(var(--mapache-screen-spacing),env(safe-area-inset-right,0px))] pb-[max(var(--mapache-screen-spacing),env(safe-area-inset-bottom,0px))] pl-[max(var(--mapache-screen-spacing),env(safe-area-inset-left,0px))]",
  {
    variants: {
      viewport: {
        fixed: "h-[100dvh] overflow-hidden",
        scrollable: "min-h-[100dvh]",
      },
      spacing: {
        "safe-area-only": "[--mapache-screen-spacing:0px]",
        compact:
          "[--mapache-screen-spacing:1rem] sm:[--mapache-screen-spacing:1.5rem]",
        standard:
          "[--mapache-screen-spacing:1rem] sm:[--mapache-screen-spacing:2rem]",
        "standard-xl":
          "[--mapache-screen-spacing:1rem] xl:[--mapache-screen-spacing:2rem]",
      },
    },
    defaultVariants: {
      viewport: "scrollable",
      spacing: "standard",
    },
  },
)

export default function MapacheScreen({
  className,
  viewport,
  spacing,
  ...props
}: ComponentProps<"main"> & VariantProps<typeof mapacheScreenVariants>) {
  return (
    <main
      data-slot="mapache-screen"
      className={cn(mapacheScreenVariants({ viewport, spacing, className }))}
      {...props}
    />
  )
}

"use client"

import { Progress as ProgressPrimitive } from "radix-ui"
import * as React from "react"
import { cn } from "@/lib/utils"

function Progress({
  className,
  indicatorClassName,
  value,
  max = 100,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string
}) {
  const progressPercentage = ((value ?? 0) / max) * 100

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      className={cn(
        "border-border bg-card relative h-4 w-full overflow-hidden border-2",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "bg-primary h-full w-full transition-transform motion-reduce:transition-none",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - progressPercentage}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }

import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-card text-card-foreground placeholder:text-card-foreground/60 focus-visible:ring-ring focus-visible:ring-offset-card aria-invalid:border-destructive aria-invalid:ring-destructive field-sizing-content min-h-24 w-full border-4 px-4 py-3 text-lg font-bold outline-none focus-visible:ring-4 focus-visible:ring-offset-4 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }

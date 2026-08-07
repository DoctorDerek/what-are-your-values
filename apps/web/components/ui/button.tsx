import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import * as React from "react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap border-4 border-black text-lg font-black uppercase transition-[transform,box-shadow,color,background-color] outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#000000] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#000000] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none",
        outline:
          "bg-card text-card-foreground shadow-[6px_6px_0px_0px_#000000] hover:bg-secondary hover:text-secondary-foreground active:translate-x-[6px] active:translate-y-[6px] active:shadow-none",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[6px_6px_0px_0px_#000000] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#000000] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none",
        ghost:
          "border-transparent bg-transparent text-foreground hover:border-black hover:bg-accent hover:text-accent-foreground",
        link: "min-h-0 border-0 bg-transparent p-0 text-foreground underline underline-offset-4",
      },
      size: {
        default: "px-5 py-3",
        sm: "min-h-10 px-3 py-2 text-base",
        lg: "min-h-14 px-6 py-4 text-2xl",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Component = asChild ? Slot.Root : "button"

  return (
    <Component
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

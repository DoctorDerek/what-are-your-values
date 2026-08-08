import { Slot } from "@rn-primitives/slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { Pressable } from "react-native"
import { TextClassContext } from "@/components/ui/text"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "items-center justify-center border-4 border-black shadow-[5px_5px_0px_0px_#000000] active:translate-x-[5px] active:translate-y-[5px] active:shadow-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-mapache-vivid-primary-orange",
        secondary: "bg-mapache-vivid-primary-cyan",
        outline: "bg-white",
        destructive: "bg-mapache-vivid-secondary-red",
      },
      size: {
        default: "min-h-14 px-5 py-3",
        compact: "min-h-12 px-4 py-2",
        large: "min-h-16 px-6 py-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

const buttonTextVariants = cva("text-center font-black uppercase", {
  variants: {
    variant: {
      default: "text-black",
      secondary: "text-black",
      outline: "text-black",
      destructive: "text-black",
    },
    size: {
      default: "text-xl",
      compact: "text-base",
      large: "text-2xl",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
})

function Button({
  asChild = false,
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Component = asChild ? Slot : Pressable

  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <Component
        accessibilityRole="button"
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    </TextClassContext.Provider>
  )
}

export { Button, buttonTextVariants, buttonVariants }

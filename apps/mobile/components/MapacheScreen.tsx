import type { ComponentProps } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { withUniwind } from "uniwind"
import { cn } from "@/lib/utils"

const UniwindSafeAreaView = withUniwind(SafeAreaView)

export default function MapacheScreen({
  className,
  ...props
}: ComponentProps<typeof UniwindSafeAreaView>) {
  return (
    <UniwindSafeAreaView
      className={cn("bg-mapache-vivid-dark flex-1", className)}
      {...props}
    />
  )
}

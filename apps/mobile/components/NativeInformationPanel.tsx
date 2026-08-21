import type { ReactNode } from "react"
import { Modal, ScrollView, View } from "react-native"
import MapacheScreen from "@/components/MapacheScreen"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"

type NativeInformationPanelFrameProps = Readonly<{
  title: string
  children: ReactNode
  primaryActionLabel: string
  onPrimaryAction: () => void
  accessibleCloseLabel?: string
  modal?: boolean
}>

function NativeInformationPanelFrame({
  title,
  children,
  primaryActionLabel,
  onPrimaryAction,
  accessibleCloseLabel,
  modal = false,
}: NativeInformationPanelFrameProps) {
  return (
    <MapacheScreen
      accessibilityLabel={modal ? title : undefined}
      accessibilityViewIsModal={modal || undefined}
      role={modal ? "dialog" : undefined}
    >
      <View className="flex-1 p-5">
        <View className="m-auto max-h-full w-full max-w-3xl flex-1 overflow-hidden border-4 border-black bg-white shadow-[8px_8px_0px_0px_#000000]">
          <View className="relative border-b-4 border-black p-5">
            <Text
              variant="h1"
              className={cn(
                "text-mapache-vivid-primary-raspberry text-4xl uppercase",
                accessibleCloseLabel && "pr-14",
              )}
            >
              {title}
            </Text>
            {accessibleCloseLabel ? (
              <Button
                accessibilityLabel={accessibleCloseLabel}
                size="compact"
                variant="outline"
                className="absolute top-3 right-3 h-12 w-12 p-0 shadow-none"
                onPress={onPrimaryAction}
              >
                <Text className="text-3xl leading-8">×</Text>
              </Button>
            ) : null}
          </View>

          <ScrollView
            className="min-h-0 flex-1"
            contentContainerClassName="gap-4 p-5"
          >
            {children}
          </ScrollView>

          <View className="border-t-4 border-black p-5">
            <Button size="large" onPress={onPrimaryAction}>
              <Text>{primaryActionLabel}</Text>
            </Button>
          </View>
        </View>
      </View>
    </MapacheScreen>
  )
}

export default function NativeInformationPanel(
  props: NativeInformationPanelFrameProps,
) {
  return <NativeInformationPanelFrame {...props} />
}

export function ReopenedNativeInformationPanel({
  open,
  onOpenChange,
  ...frameProps
}: NativeInformationPanelFrameProps &
  Readonly<{
    open: boolean
    onOpenChange: (open: boolean) => void
  }>) {
  return (
    <Modal
      animationType="fade"
      presentationStyle="fullScreen"
      visible={open}
      onRequestClose={() => onOpenChange(false)}
    >
      <NativeInformationPanelFrame {...frameProps} modal />
    </Modal>
  )
}

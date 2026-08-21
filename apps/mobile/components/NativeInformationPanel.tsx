import type { ReactNode } from "react"
import { ScrollView, View } from "react-native"
import MapacheScreen from "@/components/MapacheScreen"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

export default function NativeInformationPanel({
  title,
  children,
  primaryActionLabel,
  onPrimaryAction,
}: {
  readonly title: string
  readonly children: ReactNode
  readonly primaryActionLabel: string
  readonly onPrimaryAction: () => void
}) {
  return (
    <MapacheScreen>
      <View className="flex-1 p-5">
        <View className="m-auto max-h-full w-full max-w-3xl flex-1 overflow-hidden border-4 border-black bg-white shadow-[8px_8px_0px_0px_#000000]">
          <View className="border-b-4 border-black p-5">
            <Text
              variant="h1"
              className="text-mapache-vivid-primary-raspberry text-4xl uppercase"
            >
              {title}
            </Text>
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

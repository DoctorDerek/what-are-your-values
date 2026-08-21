import {
  PRODUCT_MENU_COPY,
  PRODUCT_MENU_DESTINATIONS,
  type ProductMenuDestinationId,
} from "@game/data/src/ProductMenu"
import { Modal, ScrollView, View } from "react-native"
import MapacheScreen from "@/components/MapacheScreen"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

export default function NativeProductMenu({
  contextActionLabel,
  open,
  onDestinationSelect,
  onOpenChange,
}: {
  readonly contextActionLabel:
    | typeof PRODUCT_MENU_COPY.closeAction
    | typeof PRODUCT_MENU_COPY.resumeBattleAction
  readonly open: boolean
  readonly onDestinationSelect: (
    destinationId: ProductMenuDestinationId,
  ) => void
  readonly onOpenChange: (open: boolean) => void
}) {
  return (
    <Modal
      animationType="fade"
      presentationStyle="fullScreen"
      visible={open}
      onRequestClose={() => onOpenChange(false)}
    >
      <MapacheScreen
        accessibilityLabel={PRODUCT_MENU_COPY.title}
        accessibilityViewIsModal
        role="dialog"
      >
        <View className="border-b-4 border-black px-5 py-5 xl:px-8 xl:py-7">
          <Text
            variant="h1"
            className="text-mapache-vivid-primary-cyan text-left text-5xl uppercase"
          >
            {PRODUCT_MENU_COPY.title}
          </Text>
        </View>

        <View className="border-b-4 border-black p-5 xl:p-8">
          <Button size="large" onPress={() => onOpenChange(false)}>
            <Text>{contextActionLabel}</Text>
          </Button>
        </View>

        <ScrollView
          accessibilityLabel="Menu destinations"
          className="min-h-0 flex-1"
          contentContainerClassName="gap-4 p-5 pb-10 xl:p-8 xl:pb-12"
        >
          {PRODUCT_MENU_DESTINATIONS.map((destination) => (
            <Button
              key={destination.id}
              size="large"
              variant="outline"
              onPress={() => onDestinationSelect(destination.id)}
            >
              <Text className="text-left">{destination.label}</Text>
            </Button>
          ))}
        </ScrollView>
      </MapacheScreen>
    </Modal>
  )
}

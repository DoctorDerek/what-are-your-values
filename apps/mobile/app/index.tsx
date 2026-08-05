import { View } from "react-native"
import { Text } from "@/components/ui/text"

export default function HomeScreen() {
  return (
    <View className="bg-background flex-1 items-center justify-center px-6">
      <Text variant="h1" className="text-mapache-vivid-primary-cyan text-2xl">
        What Are Your Values, Mapache?
      </Text>
      <Text className="text-muted-foreground mt-3 text-center text-base">
        Choose the value that matters more.
      </Text>
    </View>
  )
}

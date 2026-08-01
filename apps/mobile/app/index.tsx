import { Text, View } from "react-native"

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-950 px-6">
      <Text className="text-center text-2xl font-bold text-white">
        What Are Your Values, Mapache?
      </Text>
      <Text className="mt-3 text-center text-base text-slate-300">
        Choose the value that matters more.
      </Text>
    </View>
  )
}

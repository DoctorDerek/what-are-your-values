import { introductionCopy } from "@game/data/src/IntroductionCopy"
import { ScrollView, View } from "react-native"
import MapacheScreen from "@/components/MapacheScreen"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

export default function NativeIntroduction({
  notice = null,
  onComplete,
}: {
  notice?: string | null
  onComplete: () => void
}) {
  return (
    <MapacheScreen>
      <ScrollView className="flex-1" contentContainerClassName="grow p-5">
        <View className="m-auto w-full max-w-3xl border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000]">
          <Text
            variant="h1"
            className="text-mapache-vivid-primary-raspberry text-4xl uppercase"
          >
            {introductionCopy.title}
          </Text>
          <View className="mt-5 gap-4">
            {notice ? (
              <Text
                accessibilityLiveRegion="polite"
                className="bg-mapache-vivid-secondary-green border-4 border-black p-4 text-lg font-black text-black"
              >
                {notice}
              </Text>
            ) : null}
            <Text className="text-2xl leading-8 font-black text-black">
              {introductionCopy.tagline}
            </Text>
            {introductionCopy.body.map((paragraph) => (
              <Text
                key={paragraph}
                className="text-lg leading-7 font-medium text-black"
              >
                {paragraph}
              </Text>
            ))}
          </View>
          <Button className="mt-6" size="large" onPress={onComplete}>
            <Text>{introductionCopy.startAction}</Text>
          </Button>
        </View>
      </ScrollView>
    </MapacheScreen>
  )
}

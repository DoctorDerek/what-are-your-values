import { introductionCopy } from "@game/data/src/IntroductionCopy"
import { View } from "react-native"
import NativeInformationPanel from "@/components/NativeInformationPanel"
import { Text } from "@/components/ui/text"

export default function NativeIntroduction({
  notice = null,
  onComplete,
}: {
  notice?: string | null
  onComplete: () => void
}) {
  return (
    <NativeInformationPanel
      title={introductionCopy.title}
      primaryActionLabel={introductionCopy.startAction}
      onPrimaryAction={onComplete}
    >
      <View className="gap-4">
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
    </NativeInformationPanel>
  )
}

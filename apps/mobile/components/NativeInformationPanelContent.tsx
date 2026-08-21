import type {
  InformationPanelBlock,
  InformationPanelDefinition,
} from "@game/data/src/InformationPanels"
import { Linking, View } from "react-native"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

function NativeInformationPanelContentBlock({
  block,
}: {
  readonly block: InformationPanelBlock
}) {
  if (block.kind === "section")
    return (
      <View className="gap-3">
        <Text className="text-2xl leading-8 font-black text-black">
          {block.heading}
        </Text>
        {block.paragraphs.map((paragraph) => (
          <Text
            key={paragraph}
            className="text-lg leading-7 font-medium text-black"
          >
            {paragraph}
          </Text>
        ))}
      </View>
    )

  if (block.kind === "lead")
    return (
      <Text className="text-2xl leading-8 font-black text-black">
        {block.text}
      </Text>
    )

  if (block.kind === "paragraph")
    return (
      <Text className="text-lg leading-7 font-medium text-black">
        {block.text}
      </Text>
    )

  if (block.kind === "signature")
    return (
      <Text className="text-right text-lg leading-7 font-black text-black">
        {block.text}
      </Text>
    )

  if (block.kind === "resource")
    return (
      <View className="gap-3 border-4 border-black bg-white p-4 shadow-[5px_5px_0px_0px_#000000]">
        <Text className="text-2xl leading-8 font-black text-black">
          {block.title}
        </Text>
        <Text className="text-lg leading-7 font-medium text-black">
          {block.description}
        </Text>
        <Button
          accessibilityRole="link"
          variant="outline"
          onPress={() => void Linking.openURL(block.url)}
        >
          <Text>{block.actionLabel}</Text>
        </Button>
      </View>
    )

  return block satisfies never
}

export default function NativeInformationPanelContent({
  informationPanel,
}: {
  readonly informationPanel: InformationPanelDefinition
}) {
  return (
    <View className="gap-6">
      {informationPanel.blocks.map((block, index) => (
        <NativeInformationPanelContentBlock
          key={`${informationPanel.id}:${index}`}
          block={block}
        />
      ))}
    </View>
  )
}

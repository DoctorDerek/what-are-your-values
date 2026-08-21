import {
  CONTROL_ACTION_LABELS,
  CONTROL_SEMANTIC_ACTIONS,
  CONTROLS_COPY,
  NATIVE_CONTROL_GROUPS,
} from "@game/data/src/Controls"
import { View } from "react-native"
import { ReopenedNativeInformationPanel } from "@/components/NativeInformationPanel"
import { Text } from "@/components/ui/text"

export default function NativeControls({
  open,
  onOpenChange,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}) {
  return (
    <ReopenedNativeInformationPanel
      open={open}
      accessibleCloseLabel={CONTROLS_COPY.closeAction}
      primaryActionLabel={CONTROLS_COPY.closeAction}
      title={CONTROLS_COPY.title}
      onOpenChange={onOpenChange}
      onPrimaryAction={() => onOpenChange(false)}
    >
      <View className="gap-8">
        <Text className="text-xl leading-8 font-bold text-black">
          {CONTROLS_COPY.introduction}
        </Text>

        <View className="gap-4">
          <Text variant="h2" className="border-0 text-black">
            {CONTROLS_COPY.semanticActionsHeading}
          </Text>
          {CONTROL_SEMANTIC_ACTIONS.map((action) => (
            <View
              key={action.id}
              className="border-l-8 border-black bg-gray-100 px-4 py-3"
            >
              <Text className="text-xl leading-7 font-black text-black">
                {CONTROL_ACTION_LABELS[action.id]}
              </Text>
              <Text className="mt-1 text-lg leading-7 font-medium text-black">
                {action.description}
              </Text>
            </View>
          ))}
        </View>

        <View className="gap-5">
          <Text variant="h2" className="border-0 text-black">
            {CONTROLS_COPY.bindingsHeading}
          </Text>
          {NATIVE_CONTROL_GROUPS.map((group) => (
            <View key={group.id} className="gap-3">
              <Text variant="h3" className="text-black">
                {group.title}
              </Text>
              {group.bindings.map((binding) => (
                <View
                  key={`${group.id}:${binding.actionId}`}
                  className="gap-1 border-4 border-black p-4"
                >
                  <Text className="text-lg leading-7 font-black text-black">
                    {CONTROL_ACTION_LABELS[binding.actionId]}
                  </Text>
                  <Text className="text-lg leading-7 font-medium text-black">
                    {binding.input}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </ReopenedNativeInformationPanel>
  )
}

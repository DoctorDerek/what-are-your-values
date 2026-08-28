import { View } from "react-native"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

export default function NativeBattleActionBar({
  canOpenMenu,
  canUndo,
  canRedo,
  canStop,
  onOpenMenu,
  onUndo,
  onRedo,
  onStop,
}: {
  canOpenMenu: boolean
  canUndo: boolean
  canRedo: boolean
  canStop: boolean
  onOpenMenu: () => void
  onUndo: () => void
  onRedo: () => void
  onStop: () => void
}) {
  return (
    <View
      accessibilityLabel="Battle actions"
      className="flex-row gap-2 p-3 xl:gap-3"
    >
      <Button
        accessibilityLabel="Undo"
        className="min-w-0 flex-1 px-2 xl:px-4"
        disabled={!canUndo}
        size="compact"
        variant="outline"
        onPress={onUndo}
      >
        <Text
          adjustsFontSizeToFit
          className="text-sm xl:text-base"
          minimumFontScale={0.75}
          numberOfLines={1}
        >
          Undo
        </Text>
      </Button>
      <Button
        accessibilityLabel="Redo"
        className="min-w-0 flex-1 px-2 xl:px-4"
        disabled={!canRedo}
        size="compact"
        variant="outline"
        onPress={onRedo}
      >
        <Text
          adjustsFontSizeToFit
          className="text-sm xl:text-base"
          minimumFontScale={0.75}
          numberOfLines={1}
        >
          Redo
        </Text>
      </Button>
      <Button
        accessibilityLabel="Stop"
        className="min-w-0 flex-1 px-2 xl:px-4"
        disabled={!canStop}
        size="compact"
        variant="destructive"
        onPress={onStop}
      >
        <Text
          adjustsFontSizeToFit
          className="text-sm xl:text-base"
          minimumFontScale={0.75}
          numberOfLines={1}
        >
          Stop
        </Text>
      </Button>
      <Button
        accessibilityLabel="Menu"
        className="min-w-0 flex-1 px-2 xl:px-4"
        disabled={!canOpenMenu}
        size="compact"
        variant="secondary"
        onPress={onOpenMenu}
      >
        <Text
          adjustsFontSizeToFit
          className="text-sm xl:text-base"
          minimumFontScale={0.75}
          numberOfLines={1}
        >
          Menu
        </Text>
      </Button>
    </View>
  )
}

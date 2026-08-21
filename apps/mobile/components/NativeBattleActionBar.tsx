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
    <View accessibilityLabel="Battle actions" className="flex-row gap-3 p-3">
      <Button
        accessibilityLabel="Undo"
        className="flex-1"
        disabled={!canUndo}
        size="compact"
        variant="outline"
        onPress={onUndo}
      >
        <Text>Undo</Text>
      </Button>
      <Button
        accessibilityLabel="Redo"
        className="flex-1"
        disabled={!canRedo}
        size="compact"
        variant="outline"
        onPress={onRedo}
      >
        <Text>Redo</Text>
      </Button>
      <Button
        accessibilityLabel="Stop"
        className="flex-1"
        disabled={!canStop}
        size="compact"
        variant="destructive"
        onPress={onStop}
      >
        <Text>Stop</Text>
      </Button>
      <Button
        accessibilityLabel="Menu"
        className="flex-1"
        disabled={!canOpenMenu}
        size="compact"
        variant="secondary"
        onPress={onOpenMenu}
      >
        <Text>Menu</Text>
      </Button>
    </View>
  )
}

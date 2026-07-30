import {
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent,
} from "react-native"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

type MapacheButtonTone =
  "orange" | "cyan" | "purple" | "green" | "red" | "gold" | "charcoal"

const buttonBackgroundByTone = Object.freeze({
  orange: mapacheColors.orange,
  cyan: mapacheColors.cyan,
  purple: mapacheColors.purple,
  green: mapacheColors.green,
  red: mapacheColors.red,
  gold: mapacheColors.gold,
  charcoal: mapacheColors.charcoal,
}) satisfies Readonly<Record<MapacheButtonTone, string>>

export default function MapacheButton({
  accessibilityHint,
  disabled = false,
  label,
  onPress,
  tone = "orange",
}: {
  readonly accessibilityHint?: string
  readonly disabled?: boolean
  readonly label: string
  readonly onPress: (event: GestureResponderEvent) => void
  readonly tone?: MapacheButtonTone
}) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: buttonBackgroundByTone[tone] },
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    elevation: mapacheLayout.panelShadowOffset,
    justifyContent: "center",
    minHeight: mapacheLayout.minimumTouchTarget,
    paddingHorizontal: mapacheSpacing.standard,
    paddingVertical: mapacheSpacing.standard,
    shadowColor: mapacheColors.black,
    shadowOffset: {
      height: mapacheLayout.panelShadowOffset,
      width: mapacheLayout.panelShadowOffset,
    },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: mapacheColors.white,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
  },
  pressed: {
    elevation: 0,
    shadowOffset: {
      height: 0,
      width: 0,
    },
    transform: [
      { translateX: mapacheLayout.panelShadowOffset },
      { translateY: mapacheLayout.panelShadowOffset },
    ],
  },
})

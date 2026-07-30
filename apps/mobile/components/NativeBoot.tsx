import { StyleSheet, Text, View } from "react-native"
import MapacheScreen from "@/components/MapacheScreen"
import { mapacheColors } from "@/theme/MapacheVividTheme"

export default function NativeBoot() {
  return (
    <MapacheScreen>
      <View style={styles.content}>
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="header"
          style={styles.label}
        >
          Booting Machine…
        </Text>
      </View>
    </MapacheScreen>
  )
}

const styles = StyleSheet.create({
  content: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  label: {
    color: mapacheColors.cyan,
    fontSize: 42,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
  },
})

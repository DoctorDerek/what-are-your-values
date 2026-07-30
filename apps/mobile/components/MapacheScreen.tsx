import type { PropsWithChildren } from "react"
import { StyleSheet, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { mapacheColors, mapacheSpacing } from "@/theme/MapacheVividTheme"

export default function MapacheScreen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView
      edges={["top", "right", "bottom", "left"]}
      style={styles.root}
    >
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: mapacheColors.charcoal,
    flex: 1,
  },
  content: {
    flex: 1,
    padding: mapacheSpacing.standard,
  },
})

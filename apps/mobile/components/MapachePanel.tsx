import type { PropsWithChildren } from "react"
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

export default function MapachePanel({
  children,
  style,
}: PropsWithChildren<{
  readonly style?: StyleProp<ViewStyle>
}>) {
  return <View style={[styles.panel, style]}>{children}</View>
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    elevation: mapacheLayout.panelShadowOffset,
    padding: mapacheSpacing.standard,
    shadowColor: mapacheColors.black,
    shadowOffset: {
      height: mapacheLayout.panelShadowOffset,
      width: mapacheLayout.panelShadowOffset,
    },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
})

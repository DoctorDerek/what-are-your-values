import { StyleSheet, Text } from "react-native"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

export default function NativeOperationMessages({
  activity,
  issue,
  notice,
}: {
  readonly activity: string | null
  readonly issue: string | null
  readonly notice: string | null
}) {
  return (
    <>
      {activity ? (
        <Text accessibilityLiveRegion="polite" style={styles.activity}>
          {activity}
        </Text>
      ) : null}
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      {issue ? (
        <Text accessibilityRole="alert" style={styles.issue}>
          {issue}
        </Text>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  activity: {
    backgroundColor: mapacheColors.cyan,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    color: mapacheColors.white,
    fontSize: 18,
    fontWeight: "900",
    padding: mapacheSpacing.standard,
    textTransform: "uppercase",
  },
  issue: {
    backgroundColor: mapacheColors.orange,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    color: mapacheColors.white,
    fontSize: 18,
    fontWeight: "900",
    padding: mapacheSpacing.standard,
  },
  notice: {
    backgroundColor: mapacheColors.green,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    color: mapacheColors.white,
    fontSize: 18,
    fontWeight: "900",
    padding: mapacheSpacing.standard,
  },
})

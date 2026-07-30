import type { CustomValueFieldValidation } from "@game/data/src/CustomValueValidation"
import { customValueValidationMessages } from "@game/data/src/CustomValueValidationMessages"
import { StyleSheet, Text, View } from "react-native"
import { mapacheColors, mapacheSpacing } from "@/theme/MapacheVividTheme"

export default function NativeCustomValueFieldFeedback({
  field,
  maximumGraphemeCount,
  showValidationMessage,
  validation,
}: {
  readonly field: "name" | "definition"
  readonly maximumGraphemeCount: number
  readonly showValidationMessage: boolean
  readonly validation: CustomValueFieldValidation
}) {
  const validationMessage = validation.validationCode
    ? customValueValidationMessages[field][validation.validationCode]
    : null

  return (
    <View style={styles.feedback}>
      <Text style={styles.count}>
        {validation.graphemeCount} / {maximumGraphemeCount} characters
      </Text>
      {showValidationMessage && validationMessage ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {validationMessage}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  count: {
    color: mapacheColors.charcoal,
    fontSize: 13,
    fontWeight: "700",
  },
  error: {
    color: mapacheColors.raspberry,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  feedback: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mapacheSpacing.compact,
    justifyContent: "space-between",
  },
})

import {
  getValueDisplayDefinition,
  getValueDisplayName,
} from "@game/data/src/Value"
import type { RankedValue } from "@game/data/src/ValueRanking"
import { StyleSheet, Text, View } from "react-native"
import MapacheButton from "@/components/MapacheButton"
import NativeValueLevelProgress from "@/components/NativeValueLevelProgress"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

export default function NativeValueDetailsCard({
  isHighlighted,
  isPersistencePending,
  onDelete,
  onEdit,
  rankedValue,
  showRank,
}: {
  readonly isHighlighted: boolean
  readonly isPersistencePending: boolean
  readonly onDelete: () => void
  readonly onEdit: () => void
  readonly rankedValue: RankedValue
  readonly showRank: boolean
}) {
  const { definition, progress, rank } = rankedValue

  return (
    <View
      accessibilityLabel={`${getValueDisplayName(definition)} details`}
      style={[styles.card, isHighlighted ? styles.highlighted : null]}
    >
      <View style={styles.heading}>
        {showRank ? (
          <Text accessibilityLabel={`Rank ${rank}`} style={styles.rank}>
            #{rank}
          </Text>
        ) : null}
        <Text accessibilityRole="header" style={styles.name}>
          {getValueDisplayName(definition)}
        </Text>
        {definition.kind === "custom" ? (
          <Text style={styles.customLabel}>Yours</Text>
        ) : null}
      </View>
      <NativeValueLevelProgress totalXp={progress.totalXp} />
      <Text style={styles.definition}>
        “{getValueDisplayDefinition(definition)}”
      </Text>
      {definition.kind === "custom" ? (
        <View style={styles.actions}>
          <MapacheButton
            containerStyle={styles.action}
            disabled={isPersistencePending}
            label="Edit"
            onPress={onEdit}
            tone="purple"
          />
          <MapacheButton
            containerStyle={styles.action}
            disabled={isPersistencePending}
            label="Delete"
            onPress={onDelete}
            tone="red"
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  action: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: mapacheSpacing.standard,
  },
  card: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    gap: mapacheSpacing.standard,
    padding: mapacheSpacing.standard,
  },
  customLabel: {
    backgroundColor: mapacheColors.cyan,
    borderColor: mapacheColors.black,
    borderWidth: 2,
    color: mapacheColors.white,
    fontSize: 14,
    fontWeight: "900",
    paddingHorizontal: mapacheSpacing.compact,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  definition: {
    borderTopColor: mapacheColors.black,
    borderTopWidth: mapacheLayout.borderWidth,
    color: mapacheColors.charcoal,
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 28,
    paddingTop: mapacheSpacing.standard,
  },
  heading: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: mapacheSpacing.compact,
  },
  highlighted: {
    borderColor: mapacheColors.cyan,
    borderWidth: 8,
  },
  name: {
    color: mapacheColors.charcoal,
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 28,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  rank: {
    backgroundColor: mapacheColors.purple,
    borderColor: mapacheColors.black,
    borderWidth: 2,
    color: mapacheColors.white,
    fontSize: 20,
    fontWeight: "900",
    paddingHorizontal: mapacheSpacing.compact,
    paddingVertical: 4,
  },
})

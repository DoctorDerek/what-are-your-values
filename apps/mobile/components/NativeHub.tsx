import type { ValueId } from "@game/data/src/Value"
import {
  sortRankedValuesAlphabetically,
  type RankedValue,
} from "@game/data/src/ValueRanking"
import { FlatList, StyleSheet, Text, View } from "react-native"
import MapachePanel from "@/components/MapachePanel"
import MapacheScreen from "@/components/MapacheScreen"
import NativeValueActionRail from "@/components/NativeValueActionRail"
import NativeValueRow from "@/components/NativeValueRow"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

export default function NativeHub({
  notice,
  onAddCustomValue,
  onBrowseAllValues,
  onManageData,
  onOpenAchievements,
  onOpenValue,
  onStartBattle,
  rankedValues,
}: {
  readonly notice?: string | null
  readonly onAddCustomValue: () => void
  readonly onBrowseAllValues: () => void
  readonly onManageData: () => void
  readonly onOpenAchievements: () => void
  readonly onOpenValue: (valueId: ValueId) => void
  readonly onStartBattle: () => void
  readonly rankedValues: readonly RankedValue[]
}) {
  const hasComparisons = rankedValues.some(
    ({ progress }) => progress.profileComparisons > 0,
  )
  const visibleValues = hasComparisons
    ? rankedValues
    : sortRankedValuesAlphabetically(rankedValues)
  const actionRail = (
    <NativeValueActionRail
      onAddCustomValue={onAddCustomValue}
      onBrowseAllValues={onBrowseAllValues}
      onManageData={onManageData}
      onOpenAchievements={onOpenAchievements}
      onStartBattle={onStartBattle}
    />
  )

  return (
    <MapacheScreen>
      <Text accessibilityRole="header" style={styles.title}>
        Your Values
      </Text>
      {notice ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={styles.notice}
        >
          {notice}
        </Text>
      ) : null}
      <MapachePanel style={styles.panel}>
        <FlatList
          contentContainerStyle={styles.list}
          data={visibleValues}
          keyExtractor={({ definition }) => definition.id}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.heading}>
                {hasComparisons ? "Your Values" : "Included Values"}
              </Text>
              <Text accessibilityLiveRegion="polite" style={styles.description}>
                {hasComparisons
                  ? "Your ranking is based on your committed battles."
                  : "Not ranked yet. Browse the included values, then battle when you are ready."}
              </Text>
              {hasComparisons ? (
                <Text accessibilityRole="header" style={styles.sectionHeading}>
                  Top Five
                </Text>
              ) : (
                actionRail
              )}
            </View>
          }
          renderItem={({ index, item }) => (
            <View style={styles.rowGroup}>
              <NativeValueRow
                onPress={() => onOpenValue(item.definition.id)}
                rankedValue={item}
                showRank={hasComparisons}
              />
              {hasComparisons && index === 4 ? (
                <>
                  {actionRail}
                  <Text
                    accessibilityRole="header"
                    style={styles.allOtherValuesHeading}
                  >
                    All Other Values
                  </Text>
                </>
              ) : null}
            </View>
          )}
        />
      </MapachePanel>
    </MapacheScreen>
  )
}

const styles = StyleSheet.create({
  allOtherValuesHeading: {
    backgroundColor: mapacheColors.cyan,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    color: mapacheColors.white,
    fontSize: 22,
    fontWeight: "900",
    padding: mapacheSpacing.standard,
    textAlign: "center",
    textTransform: "uppercase",
  },
  description: {
    color: mapacheColors.charcoal,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 26,
  },
  header: {
    gap: mapacheSpacing.standard,
  },
  heading: {
    borderBottomColor: mapacheColors.black,
    borderBottomWidth: mapacheLayout.borderWidth,
    color: mapacheColors.charcoal,
    fontSize: 34,
    fontWeight: "900",
    paddingBottom: mapacheSpacing.standard,
    textTransform: "uppercase",
  },
  list: {
    gap: mapacheSpacing.standard,
    paddingBottom: mapacheLayout.panelShadowOffset,
  },
  notice: {
    backgroundColor: mapacheColors.green,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    color: mapacheColors.white,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: mapacheSpacing.standard,
    padding: mapacheSpacing.standard,
  },
  panel: {
    flex: 1,
  },
  rowGroup: {
    gap: mapacheSpacing.standard,
  },
  sectionHeading: {
    borderBottomColor: mapacheColors.black,
    borderBottomWidth: mapacheLayout.borderWidth,
    color: mapacheColors.charcoal,
    fontSize: 28,
    fontWeight: "900",
    paddingVertical: mapacheSpacing.compact,
    textTransform: "uppercase",
  },
  title: {
    color: mapacheColors.cyan,
    fontSize: 42,
    fontWeight: "900",
    marginBottom: mapacheSpacing.standard,
    textAlign: "center",
    textTransform: "uppercase",
  },
})

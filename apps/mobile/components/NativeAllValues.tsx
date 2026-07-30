import {
  getValueDisplayName,
  type CustomValueId,
  type ValueId,
} from "@game/data/src/Value"
import {
  sortRankedValuesAlphabetically,
  type RankedValue,
} from "@game/data/src/ValueRanking"
import { filterRankedValuesByQuery } from "@game/data/src/ValueSearch"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import MapacheButton from "@/components/MapacheButton"
import MapacheScreen from "@/components/MapacheScreen"
import NativeCustomValueDeleteConfirmation from "@/components/NativeCustomValueDeleteConfirmation"
import NativeCustomValueForm from "@/components/NativeCustomValueForm"
import NativeValueDetailsCard from "@/components/NativeValueDetailsCard"
import {
  mapacheColors,
  mapacheLayout,
  mapacheSpacing,
} from "@/theme/MapacheVividTheme"

export default function NativeAllValues({
  initialValueId = null,
  isPersistencePending = false,
  onAddCustomValue,
  onClose,
  onDeleteCustomValue,
  onUpdateCustomValue,
  openCustomValueBuilder = false,
  persistenceIssue = null,
  rankedValues,
}: {
  readonly initialValueId?: ValueId | null
  readonly isPersistencePending?: boolean
  readonly onAddCustomValue: (name: string, definition: string) => void
  readonly onClose: () => void
  readonly onDeleteCustomValue: (valueId: CustomValueId) => void
  readonly onUpdateCustomValue: (
    valueId: CustomValueId,
    name: string,
    definition: string,
  ) => void
  readonly openCustomValueBuilder?: boolean
  readonly persistenceIssue?: string | null
  readonly rankedValues: readonly RankedValue[]
}) {
  const listRef = useRef<FlatList<RankedValue>>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isAddingCustomValue, setIsAddingCustomValue] = useState(
    openCustomValueBuilder,
  )
  const [editingValueId, setEditingValueId] = useState<CustomValueId | null>(
    null,
  )
  const [deletingValueId, setDeletingValueId] = useState<CustomValueId | null>(
    null,
  )
  const [highlightedValueId, setHighlightedValueId] = useState<ValueId | null>(
    initialValueId,
  )
  const hasComparisons = rankedValues.some(
    ({ progress }) => progress.profileComparisons > 0,
  )
  const orderedValues = useMemo(
    () =>
      hasComparisons
        ? rankedValues
        : sortRankedValuesAlphabetically(rankedValues),
    [hasComparisons, rankedValues],
  )
  const visibleValues = useMemo(
    () => filterRankedValuesByQuery(orderedValues, searchQuery),
    [orderedValues, searchQuery],
  )
  const existingCustomValues = useMemo(
    () =>
      rankedValues.flatMap(({ definition }) =>
        definition.kind === "custom" ? [definition] : [],
      ),
    [rankedValues],
  )

  useEffect(() => {
    if (!highlightedValueId) {
      return
    }

    const highlightedIndex = visibleValues.findIndex(
      ({ definition }) => definition.id === highlightedValueId,
    )
    if (highlightedIndex >= 0) {
      listRef.current?.scrollToIndex({
        animated: false,
        index: highlightedIndex,
        viewPosition: 0.25,
      })
    }
  }, [highlightedValueId, visibleValues])

  const openMatchingValue = (valueId: ValueId) => {
    setIsAddingCustomValue(false)
    setEditingValueId(null)
    setDeletingValueId(null)
    setSearchQuery("")
    setHighlightedValueId(valueId)
  }

  return (
    <MapacheScreen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.screen}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <Text accessibilityRole="header" style={styles.title}>
              All Values
            </Text>
            <Text style={styles.count}>
              {rankedValues.length} Active Values
            </Text>
          </View>
          <MapacheButton
            disabled={isPersistencePending}
            label="Close"
            onPress={onClose}
            tone="red"
          />
        </View>

        <FlatList
          ref={listRef}
          contentContainerStyle={styles.list}
          data={visibleValues}
          keyboardShouldPersistTaps="handled"
          keyExtractor={({ definition }) => definition.id}
          ListEmptyComponent={
            <Text accessibilityLiveRegion="polite" style={styles.empty}>
              No values match your search.
            </Text>
          }
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.label}>Search All Values</Text>
              <TextInput
                accessibilityLabel="Search All Values"
                onChangeText={setSearchQuery}
                placeholder="Search by value name or definition"
                placeholderTextColor={mapacheColors.charcoal}
                returnKeyType="search"
                selectionColor={mapacheColors.cyan}
                style={styles.search}
                value={searchQuery}
              />
              <Text accessibilityLiveRegion="polite" style={styles.resultCount}>
                {visibleValues.length}{" "}
                {visibleValues.length === 1 ? "Value" : "Values"} Shown
              </Text>
              {persistenceIssue ? (
                <View accessibilityRole="alert" style={styles.issue}>
                  <Text style={styles.issueHeading}>
                    That change wasn’t saved.
                  </Text>
                  <Text style={styles.issueText}>
                    Your current data and draft are unchanged. Review them and
                    try again.
                  </Text>
                </View>
              ) : null}
              {isAddingCustomValue ? (
                <NativeCustomValueForm
                  existingCustomValues={existingCustomValues}
                  isPersistencePending={isPersistencePending}
                  mode="add"
                  onCancel={() => setIsAddingCustomValue(false)}
                  onOpenMatchingValue={openMatchingValue}
                  onSubmit={onAddCustomValue}
                  rankedValues={rankedValues}
                />
              ) : (
                <MapacheButton
                  disabled={isPersistencePending}
                  label="Add Custom Value"
                  onPress={() => {
                    setEditingValueId(null)
                    setDeletingValueId(null)
                    setIsAddingCustomValue(true)
                  }}
                />
              )}
            </View>
          }
          onScrollToIndexFailed={({ averageItemLength, index }) => {
            listRef.current?.scrollToOffset({
              animated: false,
              offset: averageItemLength * index,
            })
          }}
          renderItem={({ index, item }) => {
            const priorItem = visibleValues[index - 1]
            const startsTopFive =
              hasComparisons &&
              item.rank <= 5 &&
              (!priorItem || priorItem.rank > 5)
            const startsAllOtherValues =
              hasComparisons &&
              item.rank > 5 &&
              (!priorItem || priorItem.rank <= 5)
            const customDefinition =
              item.definition.kind === "custom" ? item.definition : null
            const isEditing = customDefinition?.id === editingValueId
            const isDeleting = customDefinition?.id === deletingValueId

            return (
              <View style={styles.rowGroup}>
                {startsTopFive ? (
                  <Text
                    accessibilityRole="header"
                    style={styles.sectionHeading}
                  >
                    Top Five
                  </Text>
                ) : null}
                {startsAllOtherValues ? (
                  <Text
                    accessibilityRole="header"
                    style={styles.allOtherValuesHeading}
                  >
                    All Other Values
                  </Text>
                ) : null}
                <NativeValueDetailsCard
                  isHighlighted={item.definition.id === highlightedValueId}
                  isPersistencePending={isPersistencePending}
                  onDelete={() => {
                    if (customDefinition) {
                      setEditingValueId(null)
                      setDeletingValueId(customDefinition.id)
                      setHighlightedValueId(customDefinition.id)
                    }
                  }}
                  onEdit={() => {
                    if (customDefinition) {
                      setDeletingValueId(null)
                      setEditingValueId(customDefinition.id)
                      setHighlightedValueId(customDefinition.id)
                    }
                  }}
                  rankedValue={item}
                  showRank={hasComparisons}
                />
                {isEditing && customDefinition ? (
                  <NativeCustomValueForm
                    excludedCustomValueId={customDefinition.id}
                    existingCustomValues={existingCustomValues}
                    initialDefinition={customDefinition.definition}
                    initialName={customDefinition.name}
                    isPersistencePending={isPersistencePending}
                    mode="edit"
                    onCancel={() => setEditingValueId(null)}
                    onOpenMatchingValue={openMatchingValue}
                    onSubmit={(name, definition) =>
                      onUpdateCustomValue(customDefinition.id, name, definition)
                    }
                    rankedValues={rankedValues}
                  />
                ) : null}
                {isDeleting && customDefinition ? (
                  <NativeCustomValueDeleteConfirmation
                    displayName={getValueDisplayName(customDefinition)}
                    isPersistencePending={isPersistencePending}
                    onCancel={() => setDeletingValueId(null)}
                    onConfirm={() => onDeleteCustomValue(customDefinition.id)}
                  />
                ) : null}
              </View>
            )
          }}
        />
      </KeyboardAvoidingView>
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
  count: {
    color: mapacheColors.white,
    fontSize: 18,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  empty: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    color: mapacheColors.charcoal,
    fontSize: 22,
    fontWeight: "900",
    padding: mapacheSpacing.spacious,
    textAlign: "center",
  },
  header: {
    gap: mapacheSpacing.standard,
  },
  issue: {
    backgroundColor: mapacheColors.orange,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    gap: mapacheSpacing.compact,
    padding: mapacheSpacing.standard,
  },
  issueHeading: {
    color: mapacheColors.white,
    fontSize: 22,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  issueText: {
    color: mapacheColors.white,
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 25,
  },
  label: {
    color: mapacheColors.white,
    fontSize: 20,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  list: {
    gap: mapacheSpacing.standard,
    paddingBottom: mapacheLayout.panelShadowOffset,
  },
  resultCount: {
    color: mapacheColors.white,
    fontSize: 16,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  rowGroup: {
    gap: mapacheSpacing.standard,
  },
  screen: {
    flex: 1,
    gap: mapacheSpacing.standard,
  },
  search: {
    backgroundColor: mapacheColors.white,
    borderColor: mapacheColors.black,
    borderWidth: mapacheLayout.borderWidth,
    color: mapacheColors.charcoal,
    fontSize: 19,
    fontWeight: "700",
    padding: mapacheSpacing.standard,
  },
  sectionHeading: {
    borderBottomColor: mapacheColors.white,
    borderBottomWidth: mapacheLayout.borderWidth,
    color: mapacheColors.white,
    fontSize: 28,
    fontWeight: "900",
    paddingVertical: mapacheSpacing.compact,
    textTransform: "uppercase",
  },
  title: {
    color: mapacheColors.cyan,
    fontSize: 38,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  titleCopy: {
    flex: 1,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: mapacheSpacing.standard,
  },
})

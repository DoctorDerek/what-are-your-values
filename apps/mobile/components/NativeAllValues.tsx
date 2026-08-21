import { projectAllValues } from "@game/data/src/AllValuesProjection"
import { PRODUCT_MENU_COPY } from "@game/data/src/ProductMenu"
import {
  getValueDisplayName,
  type CustomValueId,
  type ValueId,
} from "@game/data/src/Value"
import type { RankedValue } from "@game/data/src/ValueRanking"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  View,
} from "react-native"
import MapacheScreen from "@/components/MapacheScreen"
import NativeCustomValueDeleteConfirmation from "@/components/NativeCustomValueDeleteConfirmation"
import NativeCustomValueForm from "@/components/NativeCustomValueForm"
import NativeValueDetailsCard from "@/components/NativeValueDetailsCard"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

export default function NativeAllValues({
  initialValueId = null,
  isPersistencePending = false,
  onAddCustomValue,
  onClose,
  onDeleteCustomValue,
  onOpenMenu,
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
  readonly onOpenMenu: () => void
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
  const isNavigationBlocked =
    isPersistencePending ||
    isAddingCustomValue ||
    editingValueId !== null ||
    deletingValueId !== null
  const { existingCustomValues, hasComparisons, visibleValues } = useMemo(
    () => projectAllValues({ rankedValues, searchQuery }),
    [rankedValues, searchQuery],
  )

  useEffect(() => {
    if (!highlightedValueId) return

    const highlightedIndex = visibleValues.findIndex(
      ({ definition }) => definition.id === highlightedValueId,
    )
    if (highlightedIndex >= 0)
      listRef.current?.scrollToIndex({
        animated: false,
        index: highlightedIndex,
        viewPosition: 0.25,
      })
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
        className="flex-1 px-4 pb-4"
      >
        <View className="gap-4 border-b-4 border-black py-4">
          <View className="min-w-0 flex-1">
            <Text
              variant="h1"
              className="text-mapache-vivid-primary-cyan text-left text-4xl uppercase"
            >
              All Values
            </Text>
            <Text className="mt-1 text-lg font-black text-white uppercase">
              {rankedValues.length} Active Values
            </Text>
          </View>
          <View className="flex-row gap-3">
            <Button
              className="flex-1"
              disabled={isNavigationBlocked}
              variant="outline"
              onPress={onOpenMenu}
            >
              <Text>{PRODUCT_MENU_COPY.openAction}</Text>
            </Button>
            <Button
              className="flex-1"
              disabled={isNavigationBlocked}
              variant="destructive"
              onPress={onClose}
            >
              <Text>Close</Text>
            </Button>
          </View>
        </View>

        <FlatList
          ref={listRef}
          contentContainerClassName="gap-4 py-5"
          data={visibleValues}
          keyboardShouldPersistTaps="handled"
          keyExtractor={({ definition }) => definition.id}
          ListEmptyComponent={
            <Text
              accessibilityLiveRegion="polite"
              className="border-4 border-black bg-white p-8 text-center text-2xl font-black text-black"
            >
              No values match your search.
            </Text>
          }
          ListHeaderComponent={
            <View className="gap-4">
              <Text className="text-xl font-black text-white uppercase">
                Search All Values
              </Text>
              <TextInput
                accessibilityLabel="Search All Values"
                className="min-h-14 border-4 border-black bg-white p-3 text-xl font-bold text-black"
                onChangeText={setSearchQuery}
                placeholder="Search by value name or definition"
                returnKeyType="search"
                value={searchQuery}
              />
              <Text
                accessibilityLiveRegion="polite"
                className="text-base font-black text-white uppercase"
              >
                {visibleValues.length}{" "}
                {visibleValues.length === 1 ? "Value" : "Values"} Shown
              </Text>
              {persistenceIssue ? (
                <View
                  accessibilityLabel="Custom Value save failed"
                  accessibilityRole="alert"
                  className="bg-mapache-vivid-primary-orange gap-2 border-4 border-black p-4"
                >
                  <Text className="text-2xl font-black text-black uppercase">
                    That change wasn’t saved.
                  </Text>
                  <Text className="text-base leading-6 font-bold text-black">
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
                <Button
                  disabled={isPersistencePending}
                  onPress={() => {
                    setEditingValueId(null)
                    setDeletingValueId(null)
                    setIsAddingCustomValue(true)
                  }}
                >
                  <Text>Add Custom Value</Text>
                </Button>
              )}
            </View>
          }
          onScrollToIndexFailed={({ averageItemLength, index }) =>
            listRef.current?.scrollToOffset({
              animated: false,
              offset: averageItemLength * index,
            })
          }
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
              <View className="gap-4">
                {startsTopFive ? (
                  <Text
                    accessibilityRole="header"
                    className="border-b-4 border-white py-3 text-3xl font-black text-white uppercase"
                  >
                    Top Five
                  </Text>
                ) : null}
                {startsAllOtherValues ? (
                  <Text
                    accessibilityRole="header"
                    className="bg-mapache-vivid-primary-cyan border-y-8 border-black px-4 py-3 text-center text-2xl font-black text-black uppercase"
                  >
                    All Other Values
                  </Text>
                ) : null}
                <NativeValueDetailsCard
                  isHighlighted={item.definition.id === highlightedValueId}
                  isPersistencePending={isPersistencePending}
                  onDelete={() => {
                    if (!customDefinition) return
                    setEditingValueId(null)
                    setDeletingValueId(customDefinition.id)
                    setHighlightedValueId(customDefinition.id)
                  }}
                  onEdit={() => {
                    if (!customDefinition) return
                    setDeletingValueId(null)
                    setEditingValueId(customDefinition.id)
                    setHighlightedValueId(customDefinition.id)
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

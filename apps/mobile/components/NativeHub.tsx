import { projectHubValues } from "@game/data/src/HubValueProjection"
import type { ValueId } from "@game/data/src/Value"
import type { RankedValue } from "@game/data/src/ValueRanking"
import { Fragment } from "react"
import { FlatList, View } from "react-native"
import MapacheScreen from "@/components/MapacheScreen"
import NativeHubValueRow from "@/components/NativeHubValueRow"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"

export default function NativeHub({
  rankedValues,
  dataNotice,
  onAddCustomValue,
  onBrowseAllValues,
  onOpenAchievements,
  onOpenValue,
  onStartBattle,
}: {
  rankedValues: readonly RankedValue[]
  dataNotice: string | null
  onAddCustomValue: () => void
  onBrowseAllValues: () => void
  onOpenAchievements: () => void
  onOpenValue: (valueId: ValueId) => void
  onStartBattle: () => void
}) {
  const { hasComparisons, visibleValues } = projectHubValues(rankedValues)

  const hubActionRail = (
    <View className="my-5 gap-3">
      <Button size="large" onPress={onStartBattle}>
        <Text>Battle</Text>
      </Button>
      <Button variant="secondary" onPress={onBrowseAllValues}>
        <Text>Browse All Values</Text>
      </Button>
      <Button variant="outline" onPress={onAddCustomValue}>
        <Text>Add Custom Value</Text>
      </Button>
      <Button
        className="bg-mapache-vivid-secondary-gold"
        variant="outline"
        onPress={onOpenAchievements}
      >
        <Text>Achievements</Text>
      </Button>
    </View>
  )

  return (
    <MapacheScreen>
      <FlatList
        data={visibleValues}
        keyExtractor={({ definition }) => definition.id}
        contentContainerClassName="p-5 pb-10"
        ListHeaderComponent={
          <View>
            <Text
              variant="h1"
              className="text-mapache-vivid-primary-cyan mt-3 text-5xl uppercase"
            >
              Your Values
            </Text>
            <View className="mt-6 border-4 border-black bg-white p-4 shadow-[7px_7px_0px_0px_#000000]">
              <Text
                accessibilityLiveRegion="polite"
                className="text-xl font-black text-black uppercase"
              >
                {hasComparisons
                  ? "Your ranking is based on your committed battles."
                  : "Not ranked yet."}
              </Text>
              {!hasComparisons ? (
                <Text className="mt-2 text-base font-medium text-black">
                  Browse the included values, then battle when you are ready.
                </Text>
              ) : null}
              {dataNotice ? (
                <Text
                  accessibilityLiveRegion="polite"
                  className="bg-mapache-vivid-secondary-green mt-4 border-4 border-black p-3 text-base font-black text-black"
                >
                  {dataNotice}
                </Text>
              ) : null}
            </View>
            {hasComparisons ? (
              <Text
                variant="h2"
                className="mt-7 border-b-4 border-black bg-white p-3 text-3xl text-black uppercase"
              >
                Top Five
              </Text>
            ) : (
              hubActionRail
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <Fragment>
            <NativeHubValueRow
              rankedValue={item}
              showRank={hasComparisons}
              isTopFive={hasComparisons && index < 5}
              onOpen={() => onOpenValue(item.definition.id)}
            />
            {hasComparisons && index === 4 ? (
              <View>
                {hubActionRail}
                <Text className="bg-mapache-vivid-primary-cyan mb-5 border-y-8 border-black px-4 py-3 text-center text-2xl font-black text-black uppercase">
                  All Other Values
                </Text>
              </View>
            ) : null}
          </Fragment>
        )}
      />
    </MapacheScreen>
  )
}

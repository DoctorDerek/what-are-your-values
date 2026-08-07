import { projectHubValues } from "@game/data/src/HubValueProjection"
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
  onStartBattle,
}: {
  rankedValues: readonly RankedValue[]
  dataNotice: string | null
  onStartBattle: () => void
}) {
  const { hasComparisons, visibleValues } = projectHubValues(rankedValues)

  const battleAction = (
    <Button className="my-5" size="large" onPress={onStartBattle}>
      <Text>Battle</Text>
    </Button>
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
              battleAction
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <Fragment>
            <NativeHubValueRow
              rankedValue={item}
              showRank={hasComparisons}
              isTopFive={hasComparisons && index < 5}
            />
            {hasComparisons && index === 4 ? (
              <View>
                {battleAction}
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

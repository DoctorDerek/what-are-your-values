import { Text } from "@/components/ui/text"

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
        <Text
          accessibilityLiveRegion="polite"
          className="bg-mapache-vivid-primary-cyan border-4 border-black p-4 text-xl font-black text-black uppercase shadow-[5px_5px_0px_0px_#000000]"
        >
          {activity}
        </Text>
      ) : null}
      {notice ? (
        <Text
          accessibilityLiveRegion="polite"
          className="bg-mapache-vivid-secondary-green border-4 border-black p-4 text-lg leading-7 font-black text-black shadow-[5px_5px_0px_0px_#000000]"
        >
          {notice}
        </Text>
      ) : null}
      {issue ? (
        <Text
          accessibilityRole="alert"
          className="bg-mapache-vivid-primary-orange border-4 border-black p-4 text-lg leading-7 font-black text-black shadow-[5px_5px_0px_0px_#000000]"
        >
          {issue}
        </Text>
      ) : null}
    </>
  )
}

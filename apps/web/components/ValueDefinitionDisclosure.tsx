import {
  getValueDisplayDefinition,
  getValueDisplayName,
  type ActiveValueDefinition,
} from "@game/data/src/Value"

export default function ValueDefinitionDisclosure({
  definition,
}: {
  definition: ActiveValueDefinition
}) {
  const displayName = getValueDisplayName(definition)

  return (
    <details className="border-4 border-black bg-white p-3 text-black">
      <summary className="focus-visible:outline-mapache-vivid-primary-blue cursor-pointer text-lg font-black decoration-4 underline-offset-4 focus-visible:outline-4 focus-visible:outline-offset-4">
        <span className="underline decoration-dotted decoration-4 underline-offset-4">
          What {displayName} means
        </span>
      </summary>
      <p className="mt-3 text-lg leading-relaxed font-bold [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
        {getValueDisplayDefinition(definition)}
      </p>
    </details>
  )
}

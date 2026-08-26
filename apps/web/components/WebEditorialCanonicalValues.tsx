import { CANONICAL_VALUES } from "@game/data/src/CanonicalValues"

export default function WebEditorialCanonicalValues() {
  return (
    <section
      id="included-values"
      aria-labelledby="included-values-title"
      className="scroll-mt-4 border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] xl:p-8"
    >
      <h2
        id="included-values-title"
        className="border-b-4 border-black pb-4 text-3xl leading-tight font-black uppercase xl:text-5xl"
      >
        100 Included Values
      </h2>
      <dl className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        {CANONICAL_VALUES.map((canonicalValue) => (
          <div
            key={canonicalValue.id}
            className="bg-mapache-vivid-light border-4 border-black p-4 shadow-[5px_5px_0px_0px_#000000]"
          >
            <dt className="text-xl leading-tight font-black">
              {canonicalValue.englishName}
            </dt>
            <dd className="mt-2 text-lg leading-relaxed font-medium">
              {canonicalValue.sourceDefinition}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

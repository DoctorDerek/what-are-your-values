import {
  INFORMATION_PANEL_IDS,
  INFORMATION_PANELS,
  type InformationPanelBlock,
  type InformationPanelDefinition,
} from "@game/data/src/InformationPanels"

function WebEditorialInformationBlock({
  block,
}: {
  readonly block: InformationPanelBlock
}) {
  switch (block.kind) {
    case "section":
      return (
        <section className="border-mapache-vivid-primary-cyan grid grid-cols-1 gap-3 border-l-8 pl-4">
          <h3 className="text-2xl leading-tight font-black">{block.heading}</h3>
          {block.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-lg leading-relaxed font-medium">
              {paragraph}
            </p>
          ))}
        </section>
      )
    case "lead":
      return <p className="text-2xl leading-relaxed font-bold">{block.text}</p>
    case "paragraph":
      return <p className="text-lg leading-relaxed font-medium">{block.text}</p>
    case "signature":
      return (
        <p className="text-right text-xl leading-relaxed font-black">
          {block.text}
        </p>
      )
    case "resource":
      return (
        <section className="bg-mapache-vivid-light grid grid-cols-1 gap-3 border-4 border-black p-4 shadow-[6px_6px_0px_0px_#000000]">
          <h3 className="text-2xl leading-tight font-black">{block.title}</h3>
          <p className="text-lg leading-relaxed font-medium">
            {block.description}
          </p>
          <a
            href={block.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-mapache-vivid-primary-cyan text-mapache-vivid-black! w-fit max-w-full border-4 border-black px-4 py-3 text-lg font-black uppercase shadow-[5px_5px_0px_0px_#000000] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-black"
          >
            {block.actionLabel}
          </a>
        </section>
      )
  }
}

function WebEditorialInformationSection({
  informationPanel,
}: {
  readonly informationPanel: InformationPanelDefinition
}) {
  const sectionTitle =
    informationPanel.id === "introduction"
      ? "Introduction"
      : informationPanel.title
  const sectionTitleId = `${informationPanel.id}-title`

  return (
    <section
      id={informationPanel.id}
      aria-labelledby={sectionTitleId}
      className="scroll-mt-4 border-4 border-black bg-white p-5 shadow-[8px_8px_0px_0px_#000000] xl:p-8"
    >
      <h2
        id={sectionTitleId}
        className="border-b-4 border-black pb-4 text-3xl leading-tight font-black uppercase xl:text-5xl"
      >
        {sectionTitle}
      </h2>
      <div className="mt-6 grid max-w-5xl grid-cols-1 gap-6">
        {informationPanel.blocks.map((block, blockIndex) => (
          <WebEditorialInformationBlock
            key={`${informationPanel.id}:${blockIndex}`}
            block={block}
          />
        ))}
      </div>
    </section>
  )
}

export default function WebEditorialInformation() {
  return (
    <div className="grid grid-cols-1 gap-10">
      {INFORMATION_PANEL_IDS.map((informationPanelId) => (
        <WebEditorialInformationSection
          key={informationPanelId}
          informationPanel={INFORMATION_PANELS[informationPanelId]}
        />
      ))}
    </div>
  )
}

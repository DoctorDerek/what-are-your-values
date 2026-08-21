import type {
  InformationPanelBlock,
  InformationPanelDefinition,
} from "@game/data/src/InformationPanels"
import { Button } from "@/components/ui/button"

function InformationPanelContentBlock({
  block,
}: {
  readonly block: InformationPanelBlock
}) {
  if (block.kind === "section")
    return (
      <section className="grid gap-3 text-left">
        <h2 className="text-2xl leading-tight font-black">{block.heading}</h2>
        {block.paragraphs.map((paragraph) => (
          <p
            key={paragraph}
            className="text-xl leading-relaxed font-medium text-gray-800"
          >
            {paragraph}
          </p>
        ))}
      </section>
    )

  if (block.kind === "lead")
    return <p className="text-2xl leading-relaxed font-bold">{block.text}</p>

  if (block.kind === "paragraph")
    return (
      <p className="text-xl leading-relaxed font-medium text-gray-800">
        {block.text}
      </p>
    )

  if (block.kind === "signature")
    return (
      <p className="text-right text-xl leading-relaxed font-black text-black">
        {block.text}
      </p>
    )

  if (block.kind === "resource")
    return (
      <section className="grid gap-3 border-4 border-black p-4 text-left shadow-[6px_6px_0px_0px_#000000]">
        <h2 className="text-2xl leading-tight font-black">{block.title}</h2>
        <p className="text-lg leading-relaxed font-medium text-gray-800">
          {block.description}
        </p>
        <Button asChild variant="outline" className="w-full whitespace-normal">
          <a href={block.url} target="_blank" rel="noopener noreferrer">
            {block.actionLabel}
          </a>
        </Button>
      </section>
    )

  return block satisfies never
}

export default function InformationPanelContent({
  informationPanel,
}: {
  readonly informationPanel: InformationPanelDefinition
}) {
  return (
    <div className="flex flex-col gap-6 text-black">
      {informationPanel.blocks.map((block, index) => (
        <InformationPanelContentBlock
          key={`${informationPanel.id}:${index}`}
          block={block}
        />
      ))}
    </div>
  )
}

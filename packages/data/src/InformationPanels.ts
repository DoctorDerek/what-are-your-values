export const INFORMATION_PANEL_IDS = Object.freeze([
  "introduction",
  "how-it-works",
  "why-values-matter",
  "why-i-made-this-game",
  "free-resources",
  "credits-privacy",
] as const)

export type InformationPanelId = (typeof INFORMATION_PANEL_IDS)[number]

export type InformationPanelTextBlock = Readonly<{
  kind: "lead" | "paragraph" | "signature"
  text: string
}>

export type InformationPanelSectionBlock = Readonly<{
  kind: "section"
  heading: string
  paragraphs: readonly string[]
}>

export type InformationPanelResourceBlock = Readonly<{
  kind: "resource"
  title: string
  description: string
  actionLabel: string
  url: string
}>

export type InformationPanelBlock =
  | InformationPanelTextBlock
  | InformationPanelSectionBlock
  | InformationPanelResourceBlock

export type InformationPanelDefinition = Readonly<{
  id: InformationPanelId
  title: string
  accessibleCloseLabel: string
  primaryActionLabel: string
  blocks: readonly InformationPanelBlock[]
}>

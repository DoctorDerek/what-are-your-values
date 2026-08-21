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

export const HOW_IT_WORKS_INFORMATION_PANEL = Object.freeze({
  id: "how-it-works",
  title: "How It Works",
  accessibleCloseLabel: "Close How It Works",
  primaryActionLabel: "Close",
  blocks: Object.freeze([
    Object.freeze({
      kind: "lead",
      text: "WAYVM turns values clarification into a simple game: choose which of two values matters more to you right now.",
    }),
    Object.freeze({
      kind: "section",
      heading: "Start With 100 Values—or Add Your Own",
      paragraphs: Object.freeze([
        "The game includes 100 values from the public-domain 2011 Personal Values Card Sort. No list can include every value that may matter to every person, so you can add as many private Custom Values as are useful to you, with your own names and definitions.",
      ]),
    }),
    Object.freeze({
      kind: "section",
      heading: "Choose Between Two Values",
      paragraphs: Object.freeze([
        "Tap, click, or select the value that matters more to you. Both values may be important. The point is to make an honest comparison when you cannot choose both.",
      ]),
    }),
    Object.freeze({
      kind: "section",
      heading: "Build an Evolving Ranking",
      paragraphs: Object.freeze([
        "The value you choose gains XP. Each win awards 4 times the opponent’s payout tier at the start of the pair cycle, up to 400 XP. Your choices gradually shape your levels, Top Five, and complete ranking.",
        "Every first-cycle win awards 4 XP because every value begins at payout tier 1. Later cycles use each opponent’s frozen payout tier, capped at 100, so pair order inside a cycle cannot change the award.",
      ]),
    }),
    Object.freeze({
      kind: "section",
      heading: "See Your Top Five—and Every Value",
      paragraphs: Object.freeze([
        "Your Top Five compresses a large set of possibilities into something memorable. Browse All Values whenever you want the complete picture. Definitions are already visible in Battle and All Values; the Hub uses concise rows and does not hide meaning behind a definition interaction.",
      ]),
    }),
    Object.freeze({
      kind: "section",
      heading: "Play for as Long—or as Little—as You Want",
      paragraphs: Object.freeze([
        "The game eventually presents every possible pair in a balanced order. With the 100 included values, a complete cycle contains 4,950 unique comparisons. Adding Custom Values increases that total, but you never have to complete a cycle in one sitting. Stop anywhere and continue later.",
      ]),
    }),
    Object.freeze({
      kind: "section",
      heading: "Change Your Custom Values Carefully",
      paragraphs: Object.freeze([
        "Adding, editing, or removing a Custom Value changes the meaning or membership of your value deck. WAYVM preserves every retained value’s progress, explains that the current pair cycle and Undo/Redo history will clear, offers a JSON export before confirmation, and starts a deterministic Join Pass when a value joins.",
      ]),
    }),
    Object.freeze({
      kind: "section",
      heading: "Undo Mistakes",
      paragraphs: Object.freeze([
        "One tap or click makes a choice. If you choose the wrong card by accident—or simply reconsider—use Undo. Redo restores an undone choice until you create a new branch.",
      ]),
    }),
    Object.freeze({
      kind: "section",
      heading: "Turn a Value Into an Action",
      paragraphs: Object.freeze([
        "Optional reflection cards can connect one of your Top Five values with one small action today. You can dismiss them or turn them off. WAYVM does not ask you to record or prove what you do.",
      ]),
    }),
    Object.freeze({
      kind: "section",
      heading: "How This Differs From the Source Card Sort",
      paragraphs: Object.freeze([
        "The 2011 Personal Values Card Sort asks a person to sort values into three to five importance groups, identify five to ten central values, and rank those selected values. It often continues through an interview with open questions and reflective listening.",
        "WAYVM takes a different path: it repeatedly compares pairs across your entire active deck and preserves an evolving result you can revisit. It is an adaptation, not a replacement for conversation, ACT, motivational interviewing, therapy, or professional care.",
      ]),
    }),
    Object.freeze({
      kind: "section",
      heading: "Treat the Result as a Reflection, Not a Verdict",
      paragraphs: Object.freeze([
        "Your ranking is generated by this game from your choices over time. It is not a diagnosis, moral score, or permanent label. Preferences can change, and that is useful information.",
      ]),
    }),
    Object.freeze({
      kind: "paragraph",
      text: "There is no correct ranking. Your values belong to you.",
    }),
  ]),
} as const satisfies InformationPanelDefinition)

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

export const WHY_VALUES_MATTER_INFORMATION_PANEL = Object.freeze({
  id: "why-values-matter",
  title: "Why Values Matter",
  accessibleCloseLabel: "Close Why Values Matter",
  primaryActionLabel: "Close",
  blocks: Object.freeze([
    Object.freeze({
      kind: "paragraph",
      text: "Values are qualities and directions you want to express in how you live. They are not rules you have to obey, virtues you have to perform for other people, or goals you finish and cross off a list.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "Many values can sound important in isolation. Family, Health, Creativity, Achievement, Adventure, Service, Autonomy, and Inner Peace can all belong in a broad Very Important or Most Important group.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "Broad groups can be a useful starting point. The 2011 Personal Values Card Sort goes further by asking a person to select five to ten central values and rank them. WAYVM goes in a different direction: it repeatedly compares pairs across the entire active deck so trade-offs among all included and player-authored values remain visible.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "Direct comparisons make opportunity cost visible. Choosing one value over another does not make the other value bad. It simply forces a distinction that broad categories can hide.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "No published list can include every value that matters to every person. That is why WAYVM includes private Custom Values without a fixed numeric count limit. A value such as Ingenuity can be central to someone even when it is absent from the source list.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "Privacy also makes it easier to separate “values I approve of” from “what are my own core values actually.” There is no coach, employer, advertiser, global audience, or morally approved answer waiting to judge the result.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "Repeating those comparisons creates discrimination: many small choices reveal patterns. The Top Five then creates compression: it turns 100 or more possibilities into a short set you can remember while keeping the complete ranking available.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "Knowing what matters most can help you notice trade-offs, make priorities easier to remember, and choose actions that feel more like your own. It does not make every decision easy, tell you what you should value, or guarantee that you will always act consistently.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "WAYVM is inspired by values-sorting exercises used in Acceptance and Commitment Therapy, or ACT. In ACT, values can be understood as chosen directions for ongoing action rather than tasks that are completed once. WAYVM is a self-reflection game, not ACT, therapy, diagnosis, or medical care.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "Your result can evolve as you make more comparisons or as your life changes. A changing ranking is not failure. It is another opportunity to notice what matters now.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "There is no correct ranking. Start over any time by resetting your game progress.",
    }),
  ]),
} as const satisfies InformationPanelDefinition)

export const WHY_I_MADE_THIS_GAME_INFORMATION_PANEL = Object.freeze({
  id: "why-i-made-this-game",
  title: "Why I Made This Game",
  accessibleCloseLabel: "Close Why I Made This Game",
  primaryActionLabel: "Close",
  blocks: Object.freeze([
    Object.freeze({
      kind: "paragraph",
      text: "A productivity coach I worked with for about two years asked me a simple question: What are your values? I realized I did not know.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "The values exercise I had at the time asked me to sort words into broad importance piles. That was a useful starting point, but it did not force the direct comparisons I needed. It was still easy to place a socially admirable value near the top because it seemed like something I was supposed to value.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "So I built the first version of What Are Your Values, Mapache? in one day. Instead of stopping with broad categories, I compared values directly. Those repeated choices helped me identify Fun, Health, Curiosity, Ingenuity, and Creativity as my core values.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "Those five values have remained remarkably stable. They have helped me make decisions, understand myself, and build a life that feels more like my own.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "The current game uses the expanded, public-domain 2011 Personal Values Card Sort. It includes Fun, Health, Curiosity, and Creativity, but it still does not include Ingenuity. That is a useful reminder that no values list can be complete for every person. WAYVM therefore lets you add as many private Custom Values as are useful to you.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "I rebuilt this game so other people could have the same opportunity—privately, freely, and without being told what they should value.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "The game cannot tell you what your values ought to be, and there is no morally correct result. It only gives you a clearer way to notice what matters most to you.",
    }),
    Object.freeze({
      kind: "signature",
      text: "—Dr. Derek Austin",
    }),
  ]),
} as const satisfies InformationPanelDefinition)

export const FREE_RESOURCES_INFORMATION_PANEL = Object.freeze({
  id: "free-resources",
  title: "Free Resources",
  accessibleCloseLabel: "Close Free Resources",
  primaryActionLabel: "Close",
  blocks: Object.freeze([
    Object.freeze({
      kind: "lead",
      text: "Want to explore values, meaning, freedom, action, or practice more deeply? These independent resources are free to access.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "WAYVM is a self-reflection game, not therapy or medical advice. The organizations and authors below do not endorse or sponsor this game. These perspectives are not interchangeable, and inclusion does not imply that one tradition agrees with another.",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "External links require internet access and are governed by each destination’s privacy and accessibility practices.",
    }),
    Object.freeze({
      kind: "resource",
      title: "Doing What Matters in Times of Stress",
      description:
        "A free illustrated World Health Organization guide for coping with adversity through practical stress-management skills, including acting on values.",
      actionLabel: "Open WHO Resource",
      url: "https://www.who.int/europe/publications/i/item/9789240003910",
    }),
    Object.freeze({
      kind: "resource",
      title: "Acceptance and Commitment Therapy Values Resources",
      description:
        "Explore independent values-clarification tools and information from the Association for Contextual Behavioral Science.",
      actionLabel: "Open ACT Resource",
      url: "https://contextualscience.org/values_list_interactive_tool",
    }),
    Object.freeze({
      kind: "resource",
      title: "Personal Values Card Sort — 2011 Update",
      description:
        "Read the public-domain source for the 100 included values and definitions, the three-to-five-pile procedure, the final five-to-ten ranking, and the three blank “Other Value” cards adapted by WAYVM.",
      actionLabel: "Open the Personal Values Card Sort",
      url: "https://www.guilford.com/add/miller11_old/pers_val.pdf?t=1",
    }),
    Object.freeze({
      kind: "resource",
      title: "Viktor Frankl Institute Vienna",
      description:
        "Find authentic information about Viktor Frankl, logotherapy, existential analysis, and meaning-oriented work.",
      actionLabel: "Visit the Viktor Frankl Institute",
      url: "https://www.viktorfrankl.org/institute_agendaE.html",
    }),
    Object.freeze({
      kind: "resource",
      title: "Erich Fromm Online",
      description:
        "Explore the official website for Erich Fromm’s life and work, including material about freedom, humanism, authenticity, and conformity.",
      actionLabel: "Visit Erich Fromm Online",
      url: "https://fromm-online.org/en/",
    }),
    Object.freeze({
      kind: "resource",
      title: "Bruce Lee Foundation: Jeet Kune Do",
      description:
        "Explore Bruce Lee’s emphasis on simplicity, directness, freedom, honest self-expression, and learning from experience.",
      actionLabel: "Visit the Bruce Lee Foundation",
      url: "https://bruceleefoundation.org/jeetkunedo/",
    }),
    Object.freeze({
      kind: "resource",
      title: "The Noble Eightfold Path",
      description:
        "Read Bhikkhu Bodhi’s free introduction to the Buddhist path of understanding, intention, speech, action, livelihood, effort, mindfulness, and concentration.",
      actionLabel: "Read the Free Guide",
      url: "https://www.accesstoinsight.org/lib/authors/bodhi/waytoend.html",
    }),
    Object.freeze({
      kind: "paragraph",
      text: "Take what is useful, examine it carefully, and choose your own next step.",
    }),
  ]),
} as const satisfies InformationPanelDefinition)

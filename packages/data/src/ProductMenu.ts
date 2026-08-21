import {
  INFORMATION_PANEL_IDS,
  INFORMATION_PANELS,
  type InformationPanelId,
} from "./InformationPanels"

export const PRODUCT_MENU_COPY = Object.freeze({
  title: "Menu",
  openAction: "Menu",
  closeAction: "Close Menu",
  resumeBattleAction: "Resume Battle",
})

const PRODUCT_MENU_ROUTE_DESTINATIONS = Object.freeze([
  Object.freeze({
    kind: "route",
    id: "browse-all-values",
    label: "Browse All Values",
  }),
  Object.freeze({
    kind: "route",
    id: "custom-values",
    label: "Custom Values",
  }),
  Object.freeze({
    kind: "route",
    id: "achievements",
    label: "Achievements",
  }),
  Object.freeze({
    kind: "route",
    id: "import-export",
    label: "Import & Export",
  }),
] as const)

export type ProductMenuRouteDestination =
  (typeof PRODUCT_MENU_ROUTE_DESTINATIONS)[number]

const PRODUCT_MENU_INFORMATION_PANEL_LABEL_OVERRIDES: Readonly<
  Partial<Record<InformationPanelId, string>>
> = Object.freeze({
  introduction: "Introduction",
})

const PRODUCT_MENU_INFORMATION_PANEL_DESTINATIONS = Object.freeze(
  INFORMATION_PANEL_IDS.map((informationPanelId) =>
    Object.freeze({
      kind: "information-panel" as const,
      id: informationPanelId,
      label:
        PRODUCT_MENU_INFORMATION_PANEL_LABEL_OVERRIDES[informationPanelId] ??
        INFORMATION_PANELS[informationPanelId].title,
    }),
  ),
)

export const PRODUCT_MENU_DESTINATIONS = Object.freeze([
  ...PRODUCT_MENU_ROUTE_DESTINATIONS,
  ...PRODUCT_MENU_INFORMATION_PANEL_DESTINATIONS,
])

export type ProductMenuDestination = (typeof PRODUCT_MENU_DESTINATIONS)[number]

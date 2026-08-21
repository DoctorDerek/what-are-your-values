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

export const PRODUCT_MENU_DESTINATIONS = PRODUCT_MENU_ROUTE_DESTINATIONS

export type ProductMenuDestination = (typeof PRODUCT_MENU_DESTINATIONS)[number]

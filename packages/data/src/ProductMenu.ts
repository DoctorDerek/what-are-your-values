export const PRODUCT_MENU_COPY = Object.freeze({
  title: "Menu",
  openAction: "Menu",
  closeAction: "Close Menu",
  resumeBattleAction: "Resume Battle",
})

export const PRODUCT_MENU_DESTINATIONS = Object.freeze([
  Object.freeze({
    id: "browse-all-values",
    label: "Browse All Values",
  }),
  Object.freeze({
    id: "custom-values",
    label: "Custom Values",
  }),
  Object.freeze({
    id: "achievements",
    label: "Achievements",
  }),
  Object.freeze({
    id: "import-export",
    label: "Import & Export",
  }),
] as const)

export type ProductMenuDestination = (typeof PRODUCT_MENU_DESTINATIONS)[number]

export type ProductMenuDestinationId = ProductMenuDestination["id"]

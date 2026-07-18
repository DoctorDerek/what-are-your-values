declare const canonicalValueIdBrand: unique symbol
declare const customValueIdBrand: unique symbol

export const CANONICAL_CATALOG_VERSION = "pvcs-2011-100-v1" as const

export type CanonicalCatalogVersion = typeof CANONICAL_CATALOG_VERSION

export type CanonicalValueId = `pvcs-2011:${string}` & {
  readonly [canonicalValueIdBrand]: "canonical"
}

export type CustomValueId = `custom:${string}` & {
  readonly [customValueIdBrand]: "custom"
}

export type ValueId = CanonicalValueId | CustomValueId

export type CanonicalValueDefinition = {
  readonly kind: "canonical"
  readonly id: CanonicalValueId
  readonly sourceOrdinal: number
  readonly englishName: string
  readonly sourceDefinition: string
}

export type CustomValueDefinition = {
  readonly kind: "custom"
  readonly id: CustomValueId
  readonly name: string
  readonly definition: string
  readonly creationOrdinal: number
  readonly createdAt: string
  readonly updatedAt: string
}

export type ActiveValueDefinition =
  CanonicalValueDefinition | CustomValueDefinition

export type ValuePair = readonly [first: ValueId, second: ValueId]

export function getValueDisplayName(value: ActiveValueDefinition) {
  return value.kind === "canonical" ? value.englishName : value.name
}

export function getValueDisplayDefinition(value: ActiveValueDefinition) {
  return value.kind === "canonical" ? value.sourceDefinition : value.definition
}

const canonicalValueIdPattern = /^pvcs-2011:[a-z0-9]+(?:-[a-z0-9]+)*$/
const customValueIdPattern =
  /^custom:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isCanonicalValueId(value: string): value is CanonicalValueId {
  return canonicalValueIdPattern.test(value)
}

export function isCustomValueId(value: string): value is CustomValueId {
  return customValueIdPattern.test(value)
}

export function createCanonicalValueId(value: string) {
  if (!isCanonicalValueId(value)) {
    throw new Error(`Invalid canonical value ID: ${value}`)
  }

  return value
}

export function createCustomValueId(value: string) {
  if (!isCustomValueId(value)) {
    throw new Error(`Invalid Custom Value ID: ${value}`)
  }

  return value
}

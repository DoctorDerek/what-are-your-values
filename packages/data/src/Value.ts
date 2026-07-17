declare const canonicalValueIdBrand: unique symbol
declare const otherValueIdBrand: unique symbol

export const CANONICAL_CATALOG_VERSION = "pvcs-2011-100-v1" as const

export type CanonicalCatalogVersion = typeof CANONICAL_CATALOG_VERSION

export type CanonicalValueId = `pvcs-2011:${string}` & {
  readonly [canonicalValueIdBrand]: "canonical"
}

export type OtherValueId = `custom:${string}` & {
  readonly [otherValueIdBrand]: "other"
}

export type ValueId = CanonicalValueId | OtherValueId

export type CanonicalValueDefinition = {
  readonly kind: "canonical"
  readonly id: CanonicalValueId
  readonly sourceOrdinal: number
  readonly englishName: string
  readonly sourceDefinition: string
}

export type OtherValueDefinition = {
  readonly kind: "other"
  readonly id: OtherValueId
  readonly name: string
  readonly definition: string
  readonly creationOrdinal: number
  readonly createdAt: string
  readonly updatedAt: string
}

export type ActiveValueDefinition =
  | CanonicalValueDefinition
  | OtherValueDefinition

export type ValuePair = readonly [first: ValueId, second: ValueId]

const canonicalValueIdPattern = /^pvcs-2011:[a-z0-9]+(?:-[a-z0-9]+)*$/
const otherValueIdPattern =
  /^custom:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isCanonicalValueId(value: string): value is CanonicalValueId {
  return canonicalValueIdPattern.test(value)
}

export function isOtherValueId(value: string): value is OtherValueId {
  return otherValueIdPattern.test(value)
}

export function createCanonicalValueId(value: string) {
  if (!isCanonicalValueId(value)) {
    throw new Error(`Invalid canonical value ID: ${value}`)
  }

  return value
}

export function createOtherValueId(value: string) {
  if (!isOtherValueId(value)) {
    throw new Error(`Invalid Other Value ID: ${value}`)
  }

  return value
}

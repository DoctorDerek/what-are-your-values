const zooAnimalIds = [
  "batpack",
  "bunnypack",
  "cat01_brown",
  "cat02_dark_gray",
  "cat03_orange",
  "cat04_light_gray",
  "cat05_black",
  "chickenpack",
  "cranepack",
  "crowpack",
  "deer_female",
  "dogpack",
  "dragonfly01_blue",
  "dragonfly02_yellow",
  "dragonfly03_pink",
  "dragonfly04_green",
  "falconpack",
  "foxpack",
  "frogpack",
  "kitten01_brown",
  "kitten02_dark_gray",
  "kitten03_orange",
  "kitten04_light_gray",
  "kitten05_black",
  "lilaxolotl",
  "lildoggie01_brown",
  "lildoggie02_dark_gray",
  "lildoggie03_orange",
  "lildoggie04_light_gray",
  "lildoggie05_black",
  "lilfox_red",
  "lilfox_white",
  "lilhedgehog",
  "lilotter",
  "lilpig",
  "mouse01_dark_gray",
  "mouse02_brown",
  "mouse03_light_gray",
  "owlpack",
  "pandapack",
  "parrotpack",
  "pigpack",
  "raccoonpack",
  "turtle_spritesheets",
  "wolfpack",
] as const

export type ZooAnimalId = (typeof zooAnimalIds)[number]

export type ZooAnimal = Readonly<{
  id: ZooAnimalId
}>

export const ZOO_ANIMALS = Object.freeze(
  zooAnimalIds.map((id) => Object.freeze({ id })),
)

const zooAnimalIds = [
  "bat",
  "bunnypack",
  "catset/cat01_brown",
  "catset/cat02_dark_gray",
  "catset/cat03_orange",
  "catset/cat04_light_gray",
  "catset/cat05_black",
  "chickenpack",
  "cranepack",
  "crowpack",
  "deer_female",
  "dogpack",
  "dragonfly/dragonfly01_blue",
  "dragonfly/dragonfly02_yellow",
  "dragonfly/dragonfly03_pink",
  "dragonfly/dragonfly04_green",
  "falconpack",
  "foxpack",
  "frogpack",
  "kittens/kitten01_brown",
  "kittens/kitten02_dark_gray",
  "kittens/kitten03_orange",
  "kittens/kitten04_light_gray",
  "kittens/kitten05_black",
  "lilaxolotl",
  "lildoggies/lildoggie01_brown",
  "lildoggies/lildoggie02_dark_gray",
  "lildoggies/lildoggie03_orange",
  "lildoggies/lildoggie04_light_gray",
  "lildoggies/lildoggie05_black",
  "lilfox/lilfox_red",
  "lilfox/lilfox_white",
  "lilhedgehog",
  "lilotter",
  "lilpig",
  "mousepack/mouse01_dark_gray",
  "mousepack/mouse02_brown",
  "mousepack/mouse03_light_gray",
  "owlpack",
  "pandapack",
  "parrotpack",
  "pigpack",
  "raccoonpack",
  "turtle",
  "wolfpack",
] as const

export type ZooAnimalId = (typeof zooAnimalIds)[number]

export type ZooAnimal = Readonly<{
  id: ZooAnimalId
}>

export const ZOO_ANIMALS = Object.freeze(
  zooAnimalIds.map((id) => Object.freeze({ id })),
)

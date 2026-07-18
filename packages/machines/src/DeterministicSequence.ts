export function hashText(value: string) {
  let hash = 2_166_136_261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }

  return hash >>> 0
}

function createDeterministicRandom(seed: string) {
  let state = hashText(seed)

  return () => {
    state += 0x6d2b79f5
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function shuffleDeterministically<T>(
  values: readonly T[],
  seed: string,
) {
  const shuffled = [...values]
  const random = createDeterministicRandom(seed)

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const replacementIndex = Math.floor(random() * (index + 1))
    const replacedValue = shuffled[index]
    shuffled[index] = shuffled[replacementIndex]
    shuffled[replacementIndex] = replacedValue
  }

  return shuffled
}

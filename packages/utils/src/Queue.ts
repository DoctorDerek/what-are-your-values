export function generateQueue(ids: number[]) {
  const pairs: [number, number][] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      pairs.push([ids[i], ids[j]])
    }
  }
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = pairs[i]
    pairs[i] = pairs[j]
    pairs[j] = temp
  }
  return pairs
}

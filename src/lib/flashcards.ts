export function isTapGesture(start: [number, number], end: [number, number], threshold = 6) {
  return Math.hypot(end[0] - start[0], end[1] - start[1]) <= threshold
}

export function shuffledIds(ids: string[], random = Math.random) {
  const result = [...ids]
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target], result[index]]
  }
  return result
}

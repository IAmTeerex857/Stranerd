import { describe, expect, it } from 'vitest'
import { isTapGesture, shuffledIds } from './flashcards'

describe('flashcard interactions', () => {
  it('distinguishes taps from model rotation drags', () => {
    expect(isTapGesture([10, 10], [14, 13])).toBe(true)
    expect(isTapGesture([10, 10], [16, 10])).toBe(true)
    expect(isTapGesture([10, 10], [17, 10])).toBe(false)
  })

  it('shuffles without mutating or losing card IDs', () => {
    const source = ['a', 'b', 'c', 'd']
    const shuffled = shuffledIds(source, () => 0)
    expect(source).toEqual(['a', 'b', 'c', 'd'])
    expect(shuffled).not.toEqual(source)
    expect(new Set(shuffled)).toEqual(new Set(source))
  })
})

import { describe, expect, it } from 'vitest'
import { flashcardGradeTransition, isTapGesture, shuffledIds } from './flashcards'

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

  it('repeats Again and advances the other grades', () => {
    expect(flashcardGradeTransition('again', 0, 3)).toBe('repeat')
    expect(flashcardGradeTransition('again', 2, 3)).toBe('repeat')
    for (const grade of ['hard', 'good', 'easy'] as const) {
      expect(flashcardGradeTransition(grade, 0, 3)).toBe('next')
      expect(flashcardGradeTransition(grade, 2, 3)).toBe('complete')
    }
  })
})

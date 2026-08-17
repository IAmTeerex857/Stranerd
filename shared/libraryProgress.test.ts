import { describe, expect, it } from 'vitest'
import { mergeLibraryProgress, validateLibraryProgress, type LibraryStudyProgress } from './libraryProgress.js'

const setId = '20000000-0000-4000-8000-000000000002'
const cardA = '30000000-0000-4000-8000-000000000003'
const cardB = '40000000-0000-4000-8000-000000000004'
const attempt = '50000000-0000-4000-8000-000000000005'
const at = '2026-08-15T12:00:00.000Z'

function flashProgress(): LibraryStudyProgress {
  return { setId, setVersion: 3, attemptId: attempt, resetAt: at, kind: 'flashcards', order: { value: [cardA, cardB], updatedAt: at }, index: { value: 0, updatedAt: at }, side: { value: 'question', updatedAt: at }, items: {} }
}

describe('Library Studio progress', () => {
  it('validates bounded progress against the exact set version and items', () => {
    const progress = flashProgress()
    expect(validateLibraryProgress(progress, 'flashcards', setId, 3, [cardA, cardB])).toEqual(progress)
    expect(validateLibraryProgress({ ...progress, order: { ...progress.order!, value: [cardA, cardA] } }, 'flashcards', setId, 3, [cardA, cardB])).toBeUndefined()
    expect(validateLibraryProgress({ ...progress, items: { ['60000000-0000-4000-8000-000000000006']: { reviewed: true, updatedAt: at } } }, 'flashcards', setId, 3, [cardA, cardB])).toBeUndefined()
    expect(validateLibraryProgress(progress, 'flashcards', setId, 4, [cardA, cardB])).toBeUndefined()
  })

  it('merges independent item changes and keeps the newer navigation field', () => {
    const local = { ...flashProgress(), index: { value: 1, updatedAt: '2026-08-15T12:00:02.000Z' }, items: { [cardA]: { reviewed: true, grade: 'good' as const, updatedAt: '2026-08-15T12:00:01.000Z' } } }
    const remote = { ...flashProgress(), side: { value: 'answer' as const, updatedAt: '2026-08-15T12:00:03.000Z' }, items: { [cardB]: { reviewed: false, grade: 'again' as const, updatedAt: '2026-08-15T12:00:02.000Z' } } }
    const merged = mergeLibraryProgress(local, remote)!
    expect(merged.index.value).toBe(1)
    expect(merged.side?.value).toBe('answer')
    expect(Object.keys(merged.items).sort()).toEqual([cardA, cardB])
  })

  it('makes a newer reset attempt dominate stale device writes', () => {
    const stale = { ...flashProgress(), resetAt: '2026-08-15T12:00:01.000Z', items: { [cardA]: { reviewed: true, grade: 'easy' as const, updatedAt: '2026-08-15T12:00:09.000Z' } } }
    const reset = { ...flashProgress(), attemptId: '60000000-0000-4000-8000-000000000006', resetAt: '2026-08-15T12:00:02.000Z' }
    expect(mergeLibraryProgress(stale, reset)).toEqual(reset)
    expect(mergeLibraryProgress(reset, stale)).toEqual(reset)
  })

  it('does not treat a later reset timestamp on the same attempt as a reset', () => {
    const original = { ...flashProgress(), items: { [cardA]: { reviewed: true, grade: 'good' as const, updatedAt: '2026-08-15T12:00:03.000Z' } } }
    const malformed = { ...flashProgress(), resetAt: '2026-08-15T12:00:10.000Z' }
    expect(mergeLibraryProgress(original, malformed)?.items[cardA]?.reviewed).toBe(true)
    expect(mergeLibraryProgress(original, malformed)?.resetAt).toBe(original.resetAt)
  })
})

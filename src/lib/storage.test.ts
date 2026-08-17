import { describe, expect, it } from 'vitest'
import { parsePersistedState } from './storage'

describe('persistence parsing', () => {
  it('returns safe defaults for corrupt data', () => {
    expect(parsePersistedState('{broken').selectedModelId).toBe('heart')
  })

  it('migrates legacy state without quiz completion data', () => {
    const state = parsePersistedState(JSON.stringify({ selectedModelId: 'heart', completedLessonIds: ['heart-01'] }))
    expect(state.completedLessonIds).toEqual(['heart-01'])
    expect(state.completedQuizIds).toEqual([])
    expect(state.dissectionActionsByModel).toEqual({})
    expect(state.dissectionByModel).toEqual({})
    expect(state.flashcardProgressByDeck).toEqual({})
    expect(state.pendingFlashcardReviews).toEqual([])
    expect(state.materialProgressByRelease).toEqual({})
    expect(state.materialProgressDirtyReleaseIds).toEqual([])
    expect(state.materialProgressOwnerId).toBeUndefined()
  })

  it('keeps valid persisted dissection sessions', () => {
    const state = parsePersistedState(JSON.stringify({ dissectionByModel: { anatomy: { active: true, hiddenIds: ['stomach'], transparentIds: ['liver'], offsets: { 'stomach::0': [1, 2, 3], bad: [1] }, isolate: true, selectedIds: ['stomach'], visibleLayerIds: ['organs'] } } }))
    expect(state.dissectionByModel.anatomy).toEqual({ active: true, hiddenIds: ['stomach'], transparentIds: ['liver'], offsets: { 'stomach::0': [1, 2, 3] }, isolate: true, selectedIds: ['stomach'], visibleLayerIds: ['organs'] })
  })

  it('keeps safe selection history', () => {
    const state = parsePersistedState(JSON.stringify({
      selectedHotspotIds: { heart: 'left-atrium', bad: 3 },
    }))
    expect(state.selectedHotspotIds).toEqual({ heart: 'left-atrium' })
  })

  it('keeps valid fields and filters malformed collections', () => {
    const state = parsePersistedState(JSON.stringify({ selectedModelId: 'brain', selectedVariantIds: { brain: 'v3', bad: 2 }, completedLessonIds: ['one', 2], completedQuizIds: ['brain-quiz', false], favoriteModelIds: ['brain', 2], bookmarkedHotspotRefs: ['brain:frontal-lobe', null], notes: [{}], settings: { autoRotate: true } }))
    expect(state.selectedModelId).toBe('brain')
    expect(state.completedLessonIds).toEqual(['one'])
    expect(state.completedQuizIds).toEqual(['brain-quiz'])
    expect(state.selectedVariantIds).toEqual({ brain: 'v3' })
    expect(state.favoriteModelIds).toEqual(['brain'])
    expect(state.bookmarkedHotspotRefs).toEqual(['brain:frontal-lobe'])
    expect(state.notes).toEqual([])
    expect(state.settings.autoRotate).toBe(true)
    expect(state.settings.layers).toBe(true)
  })

  it('preserves notes and bookmarks when their navigation is unavailable', () => {
    const note = { id: 'note-1', modelId: 'heart', hotspotId: 'left-ventricle', text: 'Review wall thickness.', updatedAt: '2026-08-08T10:00:00.000Z' }
    const state = parsePersistedState(JSON.stringify({ notes: [note], bookmarkedHotspotRefs: ['heart:left-ventricle'] }))
    expect(state.notes).toEqual([note])
    expect(state.bookmarkedHotspotRefs).toEqual(['heart:left-ventricle'])
  })

  it('keeps valid flashcard grades and filters malformed reviews', () => {
    const state = parsePersistedState(JSON.stringify({ flashcardProgressByDeck: { 'heart-foundations': { contentVersion: '1', cards: { one: { grade: 'good', reviewCount: 2, updatedAt: '2026-08-08T10:00:00.000Z' }, zero: { grade: 'good', reviewCount: 0, updatedAt: '2026-08-08T10:00:00.000Z' }, invalidDate: { grade: 'easy', reviewCount: 1, updatedAt: 'never' }, bad: { grade: 'perfect', reviewCount: -1 } } } } }))
    expect(state.flashcardProgressByDeck['heart-foundations']).toEqual({ contentVersion: '1', cards: { one: { grade: 'good', reviewCount: 2, updatedAt: '2026-08-08T10:00:00.000Z' } } })
  })

  it('preserves all decks and valid pending review events', () => {
    const flashcardProgressByDeck = Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`deck-${index}`, { contentVersion: '1', cards: {} }]))
    const event = { id: '123e4567-e89b-42d3-a456-426614174000', deckId: 'deck-59', contentVersion: '1', cardId: 'card', grade: 'again', reviewedAt: '2026-08-11T10:00:00Z' }
    const state = parsePersistedState(JSON.stringify({ flashcardProgressByDeck, pendingFlashcardReviews: [event, event, { ...event, id: 'bad' }] }))
    expect(Object.keys(state.flashcardProgressByDeck)).toHaveLength(60)
    expect(state.pendingFlashcardReviews).toEqual([event])
  })

  it('repairs legacy queued reviews from local card progress', () => {
    const id = '123e4567-e89b-42d3-a456-426614174000'
    const state = parsePersistedState(JSON.stringify({
      flashcardProgressByDeck: { deck: { contentVersion: '3', cards: { card: { grade: 'easy', reviewCount: 1, updatedAt: '2026-08-11T10:00:00Z' } } } },
      pendingFlashcardReviews: [{ id, deckId: 'deck', cardId: 'card', reviewedAt: '2026-08-11T10:00:00Z' }],
    }))
    expect(state.pendingFlashcardReviews).toEqual([{ id, deckId: 'deck', contentVersion: '3', cardId: 'card', grade: 'easy', reviewedAt: '2026-08-11T10:00:00Z' }])
  })

  it('drops legacy queued reviews that cannot be repaired', () => {
    const id = '123e4567-e89b-42d3-a456-426614174000'
    const state = parsePersistedState(JSON.stringify({ pendingFlashcardReviews: [{ id, deckId: 'missing', cardId: 'card', reviewedAt: '2026-08-11T10:00:00Z' }] }))
    expect(state.pendingFlashcardReviews).toEqual([])
  })

  it('keeps valid material learning progress', () => {
    const updatedAt = '2026-08-13T10:00:00Z'
    const state = parsePersistedState(JSON.stringify({ materialProgressByRelease: { release: { contentVersion: 'v1', readSectionIds: ['one', 'one', 2], practiceAnswers: { q1: 2, bad: 8 }, practiceSubmitted: true, updatedAt } } }))
    expect(state.materialProgressByRelease.release).toEqual({ contentVersion: 'v1', readSectionIds: ['one'], practiceAnswers: { q1: 2 }, practiceSubmitted: true, updatedAt })
    expect(state.materialProgressDirtyReleaseIds).toEqual([])
  })

  it('keeps only canonical explicit material dirty IDs', () => {
    const state = parsePersistedState(JSON.stringify({ materialProgressDirtyReleaseIds: ['z', 'a', 'z', 2] }))
    expect(state.materialProgressDirtyReleaseIds).toEqual(['a', 'z'])
  })
})

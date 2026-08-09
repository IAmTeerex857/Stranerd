import { describe, expect, it } from 'vitest'
import { defaultQuizIdsForModel } from '../data/quizzes'
import { defaultPersistedState } from './storage'
import { deriveLocalLearningSummary } from './account-summary'

describe('local account learning summary', () => {
  it('uses only valid unique assessment progress and known favorites', () => {
    const heartIds = defaultQuizIdsForModel('heart')
    const summary = deriveLocalLearningSummary({ ...defaultPersistedState, completedQuizIds: [heartIds[0], heartIds[0], 'unknown'], favoriteModelIds: ['heart', 'unknown'] })
    expect(summary.completedQuestions).toBe(1)
    expect(summary.totalQuestions).toBe(200)
    expect(summary.favorites.map((model) => model.id)).toEqual(['heart'])
  })

  it('resolves valid saved structures and ignores stale references', () => {
    const summary = deriveLocalLearningSummary({ ...defaultPersistedState, bookmarkedHotspotRefs: ['heart:left-ventricle', 'heart:missing', 'broken'] })
    expect(summary.savedStructures).toHaveLength(1)
    expect(summary.savedStructures[0].hotspot.label).toBe('Left ventricle')
  })

  it('counts unique reviewed default flashcards', () => {
    const summary = deriveLocalLearningSummary({ ...defaultPersistedState, flashcardProgressByDeck: { 'heart-foundations': { contentVersion: '1', cards: { 'heart-fact-1': { grade: 'good', reviewCount: 2, updatedAt: '2026-08-08T10:00:00.000Z' } } } } })
    expect(summary.reviewedFlashcards).toBe(1)
    expect(summary.totalFlashcards).toBeGreaterThanOrEqual(60)
  })
})

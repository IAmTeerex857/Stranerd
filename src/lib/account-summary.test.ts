import { describe, expect, it } from 'vitest'
import { defaultPersistedState } from './storage'
import { deriveLocalLearningSummary } from './account-summary'

describe('local account learning summary', () => {
  it('does not expose favorites, saved structures, or assessment totals', () => {
    const summary = deriveLocalLearningSummary({ ...defaultPersistedState, favoriteModelIds: ['heart'], bookmarkedHotspotRefs: ['heart:left-ventricle'], completedQuizIds: ['heart-quiz'] })
    expect(summary).not.toHaveProperty('favorites')
    expect(summary).not.toHaveProperty('savedStructures')
    expect(summary).not.toHaveProperty('completedQuestions')
  })

  it('uses the current authored deck version', () => {
    expect(deriveLocalLearningSummary(defaultPersistedState).flashcards.every(({ deck }) => deck.contentVersion === '2')).toBe(true)
  })

  it('counts unique reviewed default flashcards', () => {
    const summary = deriveLocalLearningSummary({ ...defaultPersistedState, flashcardProgressByDeck: { 'heart-foundations': { contentVersion: '2', cards: { 'heart-exam-core': { grade: 'good', reviewCount: 2, updatedAt: '2026-08-08T10:00:00.000Z' } } } } })
    expect(summary.reviewedFlashcards).toBe(1)
    expect(summary.totalFlashcards).toBeGreaterThanOrEqual(30)
  })
})

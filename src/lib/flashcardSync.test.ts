import { describe, expect, it } from 'vitest'
import { mergeFlashcardProgress } from './flashcardSync'

describe('flashcard progress sync', () => {
  it('keeps the newest grade and highest review count', () => {
    const local = { deck: { contentVersion: '1', cards: { card: { grade: 'hard' as const, reviewCount: 3, updatedAt: '2026-08-09T10:00:00Z' } } } }
    expect(mergeFlashcardProgress(local, [{ deck_id: 'deck', card_id: 'card', grade: 'easy', review_count: 2, updated_at: '2026-08-09T11:00:00Z' }]).deck.cards.card).toEqual({ grade: 'easy', reviewCount: 3, updatedAt: '2026-08-09T11:00:00Z' })
  })
})

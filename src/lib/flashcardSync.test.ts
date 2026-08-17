import { describe, expect, it } from 'vitest'
import { mergeFlashcardProgress, normalizePendingFlashcardReviews, permanentFlashcardSyncError, type RemoteFlashcardProgress } from './flashcardSync'

const remote = (overrides: Partial<RemoteFlashcardProgress> = {}): RemoteFlashcardProgress => ({
  deck_id: 'deck', content_version: '1', card_id: 'card', grade: 'easy', review_count: 2,
  updated_at: '2026-08-09T11:00:00Z', last_review_id: '20000000-0000-4000-8000-000000000000', ...overrides,
})

describe('flashcard progress sync', () => {
  it('keeps the newest grade and highest review count', () => {
    const local = { deck: { contentVersion: '1', cards: { card: { grade: 'hard' as const, reviewCount: 3, updatedAt: '2026-08-09T10:00:00Z' } } } }
    expect(mergeFlashcardProgress(local, [remote()]).deck.cards.card).toEqual({ grade: 'easy', reviewCount: 3, updatedAt: '2026-08-09T11:00:00Z', reviewId: '20000000-0000-4000-8000-000000000000' })
  })

  it('does not let an older remote grade replace newer local progress', () => {
    const local = { deck: { contentVersion: '1', cards: { card: { grade: 'good' as const, reviewCount: 2, updatedAt: '2026-08-09T12:00:00Z', reviewId: '30000000-0000-4000-8000-000000000000' } } } }
    expect(mergeFlashcardProgress(local, [remote({ grade: 'again', review_count: 4 })]).deck.cards.card).toEqual({ ...local.deck.cards.card, reviewCount: 4 })
  })

  it('resolves equal timestamps deterministically by review ID', () => {
    const local = { deck: { contentVersion: '1', cards: { card: { grade: 'hard' as const, reviewCount: 1, updatedAt: '2026-08-09T11:00:00Z', reviewId: '10000000-0000-4000-8000-000000000000' } } } }
    expect(mergeFlashcardProgress(local, [remote()]).deck.cards.card.grade).toBe('easy')
  })

  it('keeps content versions separate and ignores malformed rows', () => {
    const local = { deck: { contentVersion: '2', cards: {} } }
    expect(mergeFlashcardProgress(local, [remote(), remote({ content_version: '2', review_count: 0 })])).toEqual(local)
  })

  it('chooses unknown content versions and cards deterministically', () => {
    const rows = [remote({ content_version: 'a', grade: 'hard' }), remote({ content_version: 'b', grade: 'good' })]
    expect(mergeFlashcardProgress({}, rows)).toEqual(mergeFlashcardProgress({}, [...rows].reverse()))
    expect(mergeFlashcardProgress({}, rows).deck.contentVersion).toBe('b')
  })

  it('only discards permanently invalid or conflicting queued reviews', () => {
    expect(permanentFlashcardSyncError({ code: '22023' })).toBe(true)
    expect(permanentFlashcardSyncError({ code: '23505' })).toBe(true)
    expect(permanentFlashcardSyncError({ code: 'PGRST202' })).toBe(false)
    expect(permanentFlashcardSyncError({ code: '57014' })).toBe(false)
  })

  it('repairs missing RPC fields before submission and rejects unrecoverable reviews', () => {
    const recoverable = { id: '123e4567-e89b-42d3-a456-426614174000', deckId: 'deck', cardId: 'card', reviewedAt: '2026-08-11T10:00:00Z' }
    const invalid = { id: '223e4567-e89b-42d3-a456-426614174000', deckId: 'materials:undefined', cardId: 'easy', reviewedAt: '2026-08-11T10:00:00Z' }
    const result = normalizePendingFlashcardReviews([recoverable, invalid] as never, { deck: { contentVersion: '3', cards: { card: { grade: 'good', reviewCount: 1, updatedAt: recoverable.reviewedAt } } } })
    expect(result.reviews).toEqual([{ ...recoverable, contentVersion: '3', grade: 'good' }])
    expect(result.rejectedIds).toEqual([invalid.id])
  })
})

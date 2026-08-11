import { supabase } from './supabase'
import type { FlashcardDeckProgress, FlashcardGrade } from '../types'
import { flashcardDeckById } from '../data/flashcards'

export function mergeFlashcardProgress(local: Record<string, FlashcardDeckProgress>, rows: { deck_id: string; card_id: string; grade: FlashcardGrade; review_count: number; updated_at: string }[]) {
  const merged = structuredClone(local)
  for (const row of rows) {
    const deck = merged[row.deck_id] ?? { contentVersion: flashcardDeckById(row.deck_id)?.contentVersion ?? '1', cards: {} }
    const existing = deck.cards[row.card_id]
    if (!existing || new Date(row.updated_at).getTime() >= new Date(existing.updatedAt).getTime()) deck.cards[row.card_id] = { grade: row.grade, reviewCount: Math.max(row.review_count, existing?.reviewCount ?? 0), updatedAt: row.updated_at }
    merged[row.deck_id] = deck
  }
  return merged
}

export async function syncFlashcardProgress(local: Record<string, FlashcardDeckProgress>) {
  if (!supabase) return local
  const { data: auth } = await supabase.auth.getSession()
  if (!auth.session) return local
  const remote: Parameters<typeof mergeFlashcardProgress>[1] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('flashcard_progress').select('deck_id,card_id,grade,review_count,updated_at').eq('user_id', auth.session.user.id).order('deck_id').order('card_id').range(from, from + 999)
    if (error) throw error
    remote.push(...((data ?? []) as typeof remote))
    if (!data || data.length < 1000) break
  }
  const merged = mergeFlashcardProgress(local, remote)
  const rows = Object.entries(merged).flatMap(([deckId, progress]) => Object.entries(progress.cards).map(([cardId, review]) => ({ user_id: auth.session!.user.id, deck_id: deckId, card_id: cardId, grade: review.grade, review_count: review.reviewCount, updated_at: review.updatedAt })))
  for (let offset = 0; offset < rows.length; offset += 500) {
    const result = await supabase.from('flashcard_progress').upsert(rows.slice(offset, offset + 500), { onConflict: 'user_id,deck_id,card_id' })
    if (result.error) throw result.error
  }
  return merged
}

export async function saveFlashcardReview(deckId: string, cardId: string, grade: FlashcardGrade, reviewCount: number, updatedAt: string) {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  if (!data.session) return
  const result = await supabase.from('flashcard_progress').upsert({ user_id: data.session.user.id, deck_id: deckId, card_id: cardId, grade, review_count: reviewCount, updated_at: updatedAt }, { onConflict: 'user_id,deck_id,card_id' })
  if (result.error) throw result.error
}

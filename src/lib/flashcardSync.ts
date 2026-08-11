import { supabase } from './supabase'
import type { FlashcardDeckProgress, FlashcardGrade, PendingFlashcardReview } from '../types'
import { flashcardDeckById } from '../data/flashcards'

const grades = ['again', 'hard', 'good', 'easy'] as const
const zeroUuid = '00000000-0000-0000-0000-000000000000'

export type RemoteFlashcardProgress = {
  deck_id: string
  content_version: string
  card_id: string
  grade: FlashcardGrade
  review_count: number
  updated_at: string
  last_review_id: string
}

function validRemoteRow(row: RemoteFlashcardProgress) {
  return typeof row.deck_id === 'string' && row.deck_id.length > 0
    && typeof row.content_version === 'string' && row.content_version.length > 0
    && typeof row.card_id === 'string' && row.card_id.length > 0
    && grades.includes(row.grade)
    && Number.isSafeInteger(row.review_count) && row.review_count > 0
    && Number.isFinite(Date.parse(row.updated_at))
    && typeof row.last_review_id === 'string'
}

export function mergeFlashcardProgress(local: Record<string, FlashcardDeckProgress>, inputRows: RemoteFlashcardProgress[]) {
  const merged = structuredClone(local)
  const rows = inputRows.filter(validRemoteRow)
  const preferredVersions = new Map<string, string>()

  for (const row of rows) {
    const expected = local[row.deck_id]?.contentVersion ?? flashcardDeckById(row.deck_id)?.contentVersion
    if (expected) preferredVersions.set(row.deck_id, expected)
    else {
      const selected = preferredVersions.get(row.deck_id)
      const selectedLatest = rows.filter((entry) => entry.deck_id === row.deck_id && entry.content_version === selected).reduce((latest, entry) => Math.max(latest, Date.parse(entry.updated_at)), -Infinity)
      if (!selected || Date.parse(row.updated_at) > selectedLatest) preferredVersions.set(row.deck_id, row.content_version)
    }
  }

  for (const row of rows) {
    if (preferredVersions.get(row.deck_id) !== row.content_version) continue
    const deck = merged[row.deck_id]?.contentVersion === row.content_version ? merged[row.deck_id] : { contentVersion: row.content_version, cards: {} }
    const existing = deck.cards[row.card_id]
    const remoteTime = Date.parse(row.updated_at)
    const localTime = existing ? Date.parse(existing.updatedAt) : -Infinity
    const remoteIsNewest = !existing || remoteTime > localTime || (remoteTime === localTime && row.last_review_id >= (existing.reviewId ?? zeroUuid))
    deck.cards[row.card_id] = remoteIsNewest
      ? { grade: row.grade, reviewCount: Math.max(row.review_count, existing?.reviewCount ?? 0), updatedAt: row.updated_at, reviewId: row.last_review_id }
      : { ...existing, reviewCount: Math.max(row.review_count, existing.reviewCount) }
    merged[row.deck_id] = deck
  }
  return merged
}

export async function syncFlashcardProgress(local: Record<string, FlashcardDeckProgress>, pending: PendingFlashcardReview[]) {
  if (!supabase) return { rows: [] as RemoteFlashcardProgress[], acknowledgedIds: [] as string[] }
  const { data: auth } = await supabase.auth.getSession()
  if (!auth.session) return { rows: [] as RemoteFlashcardProgress[], acknowledgedIds: [] as string[] }

  const pendingCounts = new Map<string, number>()
  for (const review of pending) {
    const key = `${review.deckId}\u0000${review.contentVersion}\u0000${review.cardId}`
    pendingCounts.set(key, (pendingCounts.get(key) ?? 0) + 1)
  }
  for (const [deckId, progress] of Object.entries(local)) {
    for (const [cardId, review] of Object.entries(progress.cards)) {
      const floor = review.reviewCount - (pendingCounts.get(`${deckId}\u0000${progress.contentVersion}\u0000${cardId}`) ?? 0)
      if (floor <= 0) continue
      const result = await supabase.rpc('merge_flashcard_progress_floor', { p_deck_id: deckId, p_content_version: progress.contentVersion, p_card_id: cardId, p_grade: review.grade, p_review_count: floor, p_updated_at: review.updatedAt, p_last_review_id: review.reviewId ?? zeroUuid })
      if (result.error) throw result.error
    }
  }

  const acknowledgedIds: string[] = []
  for (const review of pending) {
    const result = await supabase.rpc('record_flashcard_review', { p_review_id: review.id, p_deck_id: review.deckId, p_content_version: review.contentVersion, p_card_id: review.cardId, p_grade: review.grade, p_reviewed_at: review.reviewedAt })
    if (result.error) throw result.error
    acknowledgedIds.push(review.id)
  }

  const rows: RemoteFlashcardProgress[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('flashcard_progress').select('deck_id,content_version,card_id,grade,review_count,updated_at,last_review_id').eq('user_id', auth.session.user.id).order('deck_id').order('content_version').order('card_id').range(from, from + 999)
    if (error) throw error
    rows.push(...((data ?? []) as RemoteFlashcardProgress[]))
    if (!data || data.length < 1000) break
  }
  return { rows, acknowledgedIds }
}

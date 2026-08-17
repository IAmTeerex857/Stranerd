import { supabase } from './supabase'
import type { FlashcardDeckProgress, FlashcardGrade, PendingFlashcardReview } from '../types'

const grades = ['again', 'hard', 'good', 'easy'] as const
const zeroUuid = '00000000-0000-0000-0000-000000000000'
const syncTimeoutMs = 15_000

export type RemoteFlashcardProgress = {
  deck_id: string
  content_version: string
  card_id: string
  grade: FlashcardGrade
  review_count: number
  updated_at: string
  last_review_id: string
}

export type FlashcardSyncFailure = { reviewId: string; code?: string; message: string; permanent: boolean }

const reviewIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizePendingFlashcardReviews(pending: PendingFlashcardReview[], progressByDeck: Record<string, FlashcardDeckProgress>) {
  const reviews: PendingFlashcardReview[] = []
  const rejectedIds: string[] = []
  for (const input of pending) {
    const deck = progressByDeck[input.deckId]
    const card = deck?.cards[input.cardId]
    const contentVersion = typeof input.contentVersion === 'string' && input.contentVersion ? input.contentVersion : deck?.contentVersion
    const grade = grades.includes(input.grade) ? input.grade : card?.grade
    if (!reviewIdPattern.test(input.id) || !input.deckId || !input.cardId || !contentVersion || !grade || !Number.isFinite(Date.parse(input.reviewedAt))) {
      if (reviewIdPattern.test(input.id)) rejectedIds.push(input.id)
      continue
    }
    reviews.push({ ...input, contentVersion, grade })
  }
  return { reviews, rejectedIds }
}

export function permanentFlashcardSyncError(error: { code?: string }) {
  return error.code === '22023' || error.code === '23505'
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
  const rows = inputRows.filter(validRemoteRow).sort((a, b) => a.deck_id.localeCompare(b.deck_id) || a.content_version.localeCompare(b.content_version) || a.card_id.localeCompare(b.card_id) || a.updated_at.localeCompare(b.updated_at) || a.last_review_id.localeCompare(b.last_review_id))
  const preferredVersions = new Map<string, string>()

  for (const row of rows) {
    const expected = local[row.deck_id]?.contentVersion
    if (expected) preferredVersions.set(row.deck_id, expected)
    else {
      const selected = preferredVersions.get(row.deck_id)
      const selectedLatest = rows.filter((entry) => entry.deck_id === row.deck_id && entry.content_version === selected).reduce((latest, entry) => Math.max(latest, Date.parse(entry.updated_at)), -Infinity)
      const candidateLatest = rows.filter((entry) => entry.deck_id === row.deck_id && entry.content_version === row.content_version).reduce((latest, entry) => Math.max(latest, Date.parse(entry.updated_at)), -Infinity)
      if (!selected || candidateLatest > selectedLatest || (candidateLatest === selectedLatest && row.content_version > selected)) preferredVersions.set(row.deck_id, row.content_version)
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

function timeoutSignal(parent?: AbortSignal) {
  return parent ? AbortSignal.any([parent, AbortSignal.timeout(syncTimeoutMs)]) : AbortSignal.timeout(syncTimeoutMs)
}

export async function hydrateFlashcardProgress(signal?: AbortSignal) {
  if (!supabase) return [] as RemoteFlashcardProgress[]
  const { data: auth } = await supabase.auth.getSession()
  if (!auth.session) return [] as RemoteFlashcardProgress[]
  const requestSignal = timeoutSignal(signal)
  const rows: RemoteFlashcardProgress[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('flashcard_progress').select('deck_id,content_version,card_id,grade,review_count,updated_at,last_review_id').eq('user_id', auth.session.user.id).order('deck_id').order('content_version').order('card_id').range(from, from + 999).abortSignal(requestSignal)
    if (error) throw error
    rows.push(...((data ?? []) as RemoteFlashcardProgress[]))
    if (!data || data.length < 1000) break
  }
  return rows
}

export async function syncFlashcardProgress(pending: PendingFlashcardReview[], progressByDeck: Record<string, FlashcardDeckProgress>, signal?: AbortSignal) {
  const normalized = normalizePendingFlashcardReviews(pending, progressByDeck)
  if (!supabase || normalized.reviews.length === 0) return { rows: [] as RemoteFlashcardProgress[], acknowledgedIds: [] as string[], rejectedIds: normalized.rejectedIds, failures: [] as FlashcardSyncFailure[], failed: false }
  const requestSignal = timeoutSignal(signal)
  const acknowledgedIds: string[] = []
  const rows: RemoteFlashcardProgress[] = []
  const rejectedIds = [...normalized.rejectedIds]
  const failures: FlashcardSyncFailure[] = []
  let failed = false
  for (const review of [...normalized.reviews].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt) || a.id.localeCompare(b.id))) {
    const result = await supabase.rpc('record_flashcard_review', { p_review_id: review.id, p_deck_id: review.deckId, p_content_version: review.contentVersion, p_card_id: review.cardId, p_grade: review.grade, p_reviewed_at: review.reviewedAt }).abortSignal(requestSignal)
    if (result.error) {
      const permanent = permanentFlashcardSyncError(result.error)
      failures.push({ reviewId: review.id, code: result.error.code, message: result.error.message, permanent })
      if (permanent) rejectedIds.push(review.id)
      else failed = true
      console.error('Flashcard review sync failed', { reviewId: review.id, code: result.error.code, message: result.error.message, details: result.error.details, hint: result.error.hint })
      continue
    }
    acknowledgedIds.push(review.id)
    const row = (Array.isArray(result.data) ? result.data[0] : result.data) as RemoteFlashcardProgress | null
    if (row) rows.push(row)
  }
  return { rows, acknowledgedIds, rejectedIds, failures, failed }
}

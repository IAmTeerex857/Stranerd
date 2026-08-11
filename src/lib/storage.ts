import type { PendingFlashcardReview, PersistedState, Settings } from '../types'

export const STORAGE_KEY = 'stranerd.anatomy.v1'

export const defaultSettings: Settings = { autoRotate: false, wireframe: false, layers: true, isolate: false, labels: false }

export const defaultPersistedState: PersistedState = {
  selectedModelId: 'heart',
  selectedVariantIds: {},
  completedLessonIds: [],
  completedQuizIds: [],
  favoriteModelIds: [],
  bookmarkedHotspotRefs: [],
  notes: [],
  chatByModel: {},
  selectedHotspotIds: {},
  dissectionActionsByModel: {},
  dissectionByModel: {},
  flashcardProgressByDeck: {},
  pendingFlashcardReviews: [],
  settings: defaultSettings,
}

const grades = ['again', 'hard', 'good', 'easy'] as const
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const validText = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max

function parsePendingReviews(value: unknown): PendingFlashcardReview[] {
  if (!Array.isArray(value)) return []
  const unique = new Map<string, PendingFlashcardReview>()
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const review = item as Partial<PendingFlashcardReview>
    if (!review.id || !uuidPattern.test(review.id) || !validText(review.deckId, 200) || !validText(review.contentVersion, 200) || !validText(review.cardId, 300) || !grades.includes(review.grade as typeof grades[number]) || !validDate(review.reviewedAt)) continue
    unique.set(review.id, review as PendingFlashcardReview)
  }
  return [...unique.values()]
}

export function parsePersistedState(raw: string | null): PersistedState {
  if (!raw) return defaultPersistedState
  try {
    const value = JSON.parse(raw) as Partial<PersistedState>
    return {
      selectedModelId: typeof value.selectedModelId === 'string' ? value.selectedModelId : 'heart',
      selectedVariantIds: value.selectedVariantIds && typeof value.selectedVariantIds === 'object' && !Array.isArray(value.selectedVariantIds)
        ? Object.fromEntries(Object.entries(value.selectedVariantIds).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
        : {},
      completedLessonIds: Array.isArray(value.completedLessonIds) ? value.completedLessonIds.filter((id): id is string => typeof id === 'string') : [],
      completedQuizIds: Array.isArray(value.completedQuizIds) ? value.completedQuizIds.filter((id): id is string => typeof id === 'string') : [],
      favoriteModelIds: Array.isArray(value.favoriteModelIds) ? value.favoriteModelIds.filter((id): id is string => typeof id === 'string') : [],
      bookmarkedHotspotRefs: Array.isArray(value.bookmarkedHotspotRefs) ? value.bookmarkedHotspotRefs.filter((ref): ref is string => typeof ref === 'string') : [],
      notes: Array.isArray(value.notes)
        ? value.notes.filter((note) => note && typeof note.id === 'string' && typeof note.modelId === 'string' && typeof note.text === 'string' && typeof note.updatedAt === 'string')
        : [],
      chatByModel: value.chatByModel && typeof value.chatByModel === 'object' && !Array.isArray(value.chatByModel)
        ? Object.fromEntries(Object.entries(value.chatByModel).flatMap(([modelId, messages]) => Array.isArray(messages) ? [[modelId, messages.filter((message): message is PersistedState['chatByModel'][string][number] => Boolean(message) && typeof message === 'object' && typeof message.id === 'string' && ['mentor', 'student', 'engine'].includes(message.role) && typeof message.text === 'string').map((message) => ({ ...message, pending: false }))]] : []))
        : {},
      selectedHotspotIds: value.selectedHotspotIds && typeof value.selectedHotspotIds === 'object' && !Array.isArray(value.selectedHotspotIds)
        ? Object.fromEntries(Object.entries(value.selectedHotspotIds).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
        : {},
      dissectionActionsByModel: value.dissectionActionsByModel && typeof value.dissectionActionsByModel === 'object' && !Array.isArray(value.dissectionActionsByModel)
        ? Object.fromEntries(Object.entries(value.dissectionActionsByModel).flatMap(([modelId, actions]) => Array.isArray(actions) ? [[modelId, actions.filter((action): action is PersistedState['dissectionActionsByModel'][string][number] => Boolean(action) && typeof action === 'object' && ['select', 'hide', 'show', 'isolate', 'transparent', 'move', 'reset'].includes(action.action) && Array.isArray(action.structureIds) && action.structureIds.every((id) => typeof id === 'string') && Array.isArray(action.structures) && action.structures.every((label) => typeof label === 'string') && Array.isArray(action.hiddenStructures) && action.hiddenStructures.every((label) => typeof label === 'string') && typeof action.createdAt === 'string').slice(-30)]] : []))
        : {},
      dissectionByModel: value.dissectionByModel && typeof value.dissectionByModel === 'object' && !Array.isArray(value.dissectionByModel)
        ? Object.fromEntries(Object.entries(value.dissectionByModel).flatMap(([modelId, session]) => {
          if (!session || typeof session !== 'object' || Array.isArray(session)) return []
          const entry = session as Partial<PersistedState['dissectionByModel'][string]>
          const offsets = entry.offsets && typeof entry.offsets === 'object' && !Array.isArray(entry.offsets)
            ? Object.fromEntries(Object.entries(entry.offsets).filter((item): item is [string, [number, number, number]] => Array.isArray(item[1]) && item[1].length === 3 && item[1].every((number) => typeof number === 'number' && Number.isFinite(number))))
            : {}
          return [[modelId, {
            active: entry.active === true,
            hiddenIds: Array.isArray(entry.hiddenIds) ? entry.hiddenIds.filter((id): id is string => typeof id === 'string') : [],
            transparentIds: Array.isArray(entry.transparentIds) ? entry.transparentIds.filter((id): id is string => typeof id === 'string') : [],
            offsets,
            isolate: entry.isolate === true,
            selectedIds: Array.isArray(entry.selectedIds) ? entry.selectedIds.filter((id): id is string => typeof id === 'string') : [],
            visibleLayerIds: Array.isArray(entry.visibleLayerIds) ? entry.visibleLayerIds.filter((id): id is string => typeof id === 'string') : [],
          }]]
        }))
        : {},
      flashcardProgressByDeck: value.flashcardProgressByDeck && typeof value.flashcardProgressByDeck === 'object' && !Array.isArray(value.flashcardProgressByDeck)
        ? Object.fromEntries(Object.entries(value.flashcardProgressByDeck).flatMap(([deckId, progress]) => {
          if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return []
          const entry = progress as Partial<PersistedState['flashcardProgressByDeck'][string]>
          if (!validText(deckId, 200) || !validText(entry.contentVersion, 200) || !entry.cards || typeof entry.cards !== 'object' || Array.isArray(entry.cards)) return []
          const cards = Object.fromEntries(Object.entries(entry.cards).flatMap(([cardId, card]) => {
            if (!card || typeof card !== 'object' || Array.isArray(card)) return []
            const review = card as Partial<PersistedState['flashcardProgressByDeck'][string]['cards'][string]>
            return validText(cardId, 300) && grades.includes(review.grade as typeof grades[number]) && Number.isSafeInteger(review.reviewCount) && (review.reviewCount ?? 0) > 0 && validDate(review.updatedAt) && (review.reviewId === undefined || uuidPattern.test(review.reviewId))
              ? [[cardId, { grade: review.grade!, reviewCount: review.reviewCount!, updatedAt: review.updatedAt, ...(review.reviewId ? { reviewId: review.reviewId } : {}) }]]
              : []
          }))
          return [[deckId, { contentVersion: entry.contentVersion, cards }]]
        }))
        : {},
      pendingFlashcardReviews: parsePendingReviews(value.pendingFlashcardReviews),
      settings: Object.fromEntries(Object.entries(defaultSettings).map(([key, fallback]) => [
        key,
        value.settings && typeof value.settings === 'object' && typeof value.settings[key as keyof Settings] === 'boolean'
          ? value.settings[key as keyof Settings]
          : fallback,
      ])) as Settings,
    }
  } catch {
    return defaultPersistedState
  }
}

export function loadState(): PersistedState {
  if (typeof window === 'undefined') return defaultPersistedState
  return parsePersistedState(window.localStorage.getItem(STORAGE_KEY))
}

export function saveState(state: PersistedState): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

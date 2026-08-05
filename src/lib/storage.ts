import type { PersistedState, Settings } from '../types'

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
  settings: defaultSettings,
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

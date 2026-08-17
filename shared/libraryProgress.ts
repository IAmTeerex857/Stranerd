import { isLibraryUuid, type LibraryOutputType } from './library.js'

export type ProgressField<T> = { value: T; updatedAt: string }
export type LibraryProgressItem = { reviewed?: boolean; grade?: 'again' | 'hard' | 'good' | 'easy'; answer?: number; updatedAt: string }
export type LibraryStudyProgress = {
  setId: string
  setVersion: number
  attemptId: string
  resetAt: string
  kind: LibraryOutputType
  order?: ProgressField<string[]>
  index: ProgressField<number>
  side?: ProgressField<'question' | 'answer'>
  items: Record<string, LibraryProgressItem>
  submitted?: ProgressField<boolean>
  reviewing?: ProgressField<boolean>
  score?: ProgressField<number | null>
}

const GRADES = new Set(['again', 'hard', 'good', 'easy'])

function validTime(value: unknown) {
  if (typeof value !== 'string' || value.length > 40) return false
  const time = Date.parse(value)
  return Number.isFinite(time) && time >= Date.UTC(2020, 0, 1) && time <= Date.now() + 5 * 60_000
}

function validField(value: unknown, validValue: (entry: unknown) => boolean) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const field = value as Record<string, unknown>
  return Object.keys(field).every((key) => key === 'value' || key === 'updatedAt') && validValue(field.value) && validTime(field.updatedAt)
}

export function validateLibraryProgress(value: unknown, kind: LibraryOutputType, setId: string, setVersion: number, itemIds: readonly string[]): LibraryStudyProgress | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const progress = value as Record<string, unknown>
  const allowed = kind === 'flashcards'
    ? ['setId', 'setVersion', 'attemptId', 'resetAt', 'kind', 'order', 'index', 'side', 'items']
    : ['setId', 'setVersion', 'attemptId', 'resetAt', 'kind', 'index', 'items', 'submitted', 'reviewing', 'score']
  if (!Object.keys(progress).every((key) => allowed.includes(key)) || progress.setId !== setId || progress.setVersion !== setVersion || progress.kind !== kind || !isLibraryUuid(progress.attemptId) || !validTime(progress.resetAt)) return undefined
  if (!validField(progress.index, (entry) => Number.isInteger(entry) && Number(entry) >= 0 && Number(entry) < itemIds.length)) return undefined
  const allowedIds = new Set(itemIds)
  if (!progress.items || typeof progress.items !== 'object' || Array.isArray(progress.items)) return undefined
  const items = progress.items as Record<string, unknown>
  if (Object.keys(items).length > itemIds.length || Object.keys(items).some((id) => !isLibraryUuid(id) || !allowedIds.has(id))) return undefined
  for (const raw of Object.values(items)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
    const item = raw as Record<string, unknown>
    const keys = kind === 'flashcards' ? ['reviewed', 'grade', 'updatedAt'] : ['answer', 'updatedAt']
    if (!Object.keys(item).every((key) => keys.includes(key)) || !validTime(item.updatedAt)) return undefined
    if (kind === 'flashcards' && (typeof item.reviewed !== 'boolean' || (item.grade !== undefined && !GRADES.has(String(item.grade))))) return undefined
    if (kind === 'practice' && (!Number.isInteger(item.answer) || Number(item.answer) < 0 || Number(item.answer) > 3)) return undefined
  }
  if (kind === 'flashcards') {
    if (!validField(progress.order, (entry) => Array.isArray(entry) && entry.length === itemIds.length && new Set(entry).size === itemIds.length && entry.every((id) => typeof id === 'string' && allowedIds.has(id)))) return undefined
    if (!validField(progress.side, (entry) => entry === 'question' || entry === 'answer')) return undefined
  } else {
    if (!validField(progress.submitted, (entry) => typeof entry === 'boolean') || !validField(progress.reviewing, (entry) => typeof entry === 'boolean') || !validField(progress.score, (entry) => entry === null || Number.isInteger(entry) && Number(entry) >= 0 && Number(entry) <= itemIds.length)) return undefined
  }
  return progress as unknown as LibraryStudyProgress
}

function later<T>(left: ProgressField<T>, right: ProgressField<T>): ProgressField<T> {
  if (left.updatedAt !== right.updatedAt) return left.updatedAt > right.updatedAt ? left : right
  const comparable = (value: unknown) => value === null ? '-1' : typeof value === 'object' && !Array.isArray(value)
    ? JSON.stringify(Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))))
    : JSON.stringify(value)
  return comparable(left.value) >= comparable(right.value) ? left : right
}

function canonicalItem(item: LibraryProgressItem) {
  return JSON.stringify(Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))))
}

export function mergeLibraryProgress(local: LibraryStudyProgress | undefined, remote: LibraryStudyProgress | undefined) {
  if (!local) return remote
  if (!remote) return local
  if (local.setId !== remote.setId || local.setVersion !== remote.setVersion || local.kind !== remote.kind) return local
  if (local.attemptId !== remote.attemptId) return local.resetAt !== remote.resetAt ? local.resetAt > remote.resetAt ? local : remote : local.attemptId > remote.attemptId ? local : remote
  // An attempt ID is immutable: a later resetAt on the same attempt cannot erase it.
  const resetAt = local.resetAt < remote.resetAt ? local.resetAt : remote.resetAt
  const items = { ...remote.items }
  for (const [id, item] of Object.entries(local.items)) {
    const other = items[id]
    if (!other || item.updatedAt > other.updatedAt || item.updatedAt === other.updatedAt && canonicalItem(item) >= canonicalItem(other)) items[id] = item
  }
  return {
    ...remote,
    resetAt,
    index: later(local.index, remote.index),
    order: local.order && remote.order ? later(local.order, remote.order) : local.order ?? remote.order,
    side: local.side && remote.side ? later(local.side, remote.side) : local.side ?? remote.side,
    submitted: local.submitted && remote.submitted ? later(local.submitted, remote.submitted) : local.submitted ?? remote.submitted,
    reviewing: local.reviewing && remote.reviewing ? later(local.reviewing, remote.reviewing) : local.reviewing ?? remote.reviewing,
    score: local.score && remote.score ? later(local.score, remote.score) : local.score ?? remote.score,
    items,
  }
}

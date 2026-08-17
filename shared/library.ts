export type LibraryOutputType = 'flashcards' | 'practice'
export type LibrarySourceCategory = 'prompt' | 'document' | 'audio' | 'link' | 'youtube'

export type LibraryFlashcardContent = { front: string; back: string }
export type LibraryPracticeContent = { question: string; options: [string, string, string, string]; correctIndex: number; explanation: string }
export type LibraryItemContent = LibraryFlashcardContent | LibraryPracticeContent

export type LibraryPromptSource = { category?: 'prompt'; text: string }
export type LibraryUrlSource = { category?: 'link' | 'youtube'; url: string }
export type LibraryFileSource = {
  category?: 'document' | 'audio'
  storagePath: string
  fileName: string
  mimeType: string
  byteSize: number
}
export type LibrarySource = LibraryPromptSource | LibraryUrlSource | LibraryFileSource

export type LibraryGenerationRequest = {
  setId: string
  expectedVersion: number | null
  title: string
  outputType: LibraryOutputType
  requestedCount: number
  sourceCategory: LibrarySourceCategory
  sources: LibrarySource[]
}

export const LIBRARY_MAX_SOURCES = 10
export const LIBRARY_MAX_FILE_BYTES = 25 * 1024 * 1024
export const LIBRARY_DOCUMENT_MIME_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown', 'text/x-markdown'] as const
export const LIBRARY_AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave'] as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isLibraryUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function libraryGenerationCost(count: number) {
  return Math.ceil(count / 10) * 5
}

export function validLibraryCount(outputType: LibraryOutputType, count: number) {
  return outputType === 'flashcards' ? [10, 15, 20, 30].includes(count) : [10, 20, 30, 40].includes(count)
}

function validHttpsUrl(value: unknown, youtube: boolean) {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    if (!youtube) return true
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be'
  } catch {
    return false
  }
}

export function validateLibraryGeneration(value: unknown, userId: string): LibraryGenerationRequest | undefined {
  if (!value || typeof value !== 'object') return undefined
  const body = value as Record<string, unknown>
  if (!isLibraryUuid(body.setId) || (body.expectedVersion !== null && (!Number.isInteger(body.expectedVersion) || Number(body.expectedVersion) < 0))) return undefined
  if (typeof body.title !== 'string' || body.title.trim().length < 1 || body.title.trim().length > 160) return undefined
  if (body.outputType !== 'flashcards' && body.outputType !== 'practice') return undefined
  if (!Number.isInteger(body.requestedCount) || !validLibraryCount(body.outputType, Number(body.requestedCount))) return undefined
  if (!['prompt', 'document', 'audio', 'link', 'youtube'].includes(String(body.sourceCategory))) return undefined
  if (!Array.isArray(body.sources) || body.sources.length < 1 || body.sources.length > LIBRARY_MAX_SOURCES) return undefined
  const category = body.sourceCategory as LibrarySourceCategory
  const valid = body.sources.every((raw) => {
    if (!raw || typeof raw !== 'object') return false
    const source = raw as Record<string, unknown>
    if (source.category !== undefined && source.category !== category) return false
    if (category === 'prompt') return typeof source.text === 'string' && source.text.trim().length >= 1 && source.text.length <= 20_000
    if (category === 'link' || category === 'youtube') return validHttpsUrl(source.url, category === 'youtube')
    const mimeTypes: readonly string[] = category === 'document' ? LIBRARY_DOCUMENT_MIME_TYPES : LIBRARY_AUDIO_MIME_TYPES
    return typeof source.storagePath === 'string' && source.storagePath.startsWith(`${userId}/`) && !source.storagePath.includes('..')
      && typeof source.fileName === 'string' && source.fileName.length >= 1 && source.fileName.length <= 255
      && typeof source.mimeType === 'string' && mimeTypes.includes(source.mimeType)
      && Number.isInteger(source.byteSize) && Number(source.byteSize) >= 1 && Number(source.byteSize) <= LIBRARY_MAX_FILE_BYTES
  })
  if (!valid) return undefined
  return { ...body, title: body.title.trim() } as LibraryGenerationRequest
}

export function validFlashcardContent(value: unknown): value is LibraryFlashcardContent {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.front === 'string' && item.front.trim().length > 0 && item.front.length <= 10_000
    && typeof item.back === 'string' && item.back.trim().length > 0 && item.back.length <= 10_000
}

export function validPracticeContent(value: unknown): value is LibraryPracticeContent {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.question === 'string' && item.question.trim().length > 0 && item.question.length <= 10_000
    && Array.isArray(item.options) && item.options.length === 4 && item.options.every((option) => typeof option === 'string' && option.trim().length > 0 && option.length <= 2_000)
    && new Set(item.options.map((option) => option.trim())).size === 4
    && Number.isInteger(item.correctIndex) && Number(item.correctIndex) >= 0 && Number(item.correctIndex) < 4
    && typeof item.explanation === 'string' && item.explanation.length <= 10_000
}

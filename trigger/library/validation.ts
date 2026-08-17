import { isIP } from 'node:net'
import type { GeneratedItem, QueueMessage } from './types.js'

export const LIMITS = {
  maxSources: 10,
  maxDocumentBytes: 25 * 1024 * 1024,
  maxAudioBytes: 25 * 1024 * 1024,
  maxArticleBytes: 2 * 1024 * 1024,
  maxSourceChars: 200_000,
  maxCorpusChars: 500_000,
  maxItems: 100,
  generationBatch: 10,
} as const

export function parseQueueMessage(value: unknown): QueueMessage | undefined {
  let candidate = value
  if (typeof value === 'string') {
    try { candidate = JSON.parse(value) } catch { return undefined }
  }
  if (!candidate || typeof candidate !== 'object') return undefined
  const jobId = (candidate as Record<string, unknown>).jobId
  return typeof jobId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)
    ? { jobId }
    : undefined
}

export function generationCredits(itemCount: number): number {
  if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > LIMITS.maxItems) throw new Error('itemCount must be an integer from 1 to 100')
  return Math.ceil(itemCount / LIMITS.generationBatch) * 5
}

export function validRequestedCount(outputType: 'flashcards' | 'practice', count: number): boolean {
  return outputType === 'flashcards' ? [10, 15, 20, 30].includes(count) : [10, 20, 30, 40].includes(count)
}

export function batches(total: number, maximum = LIMITS.generationBatch): number[] {
  if (!Number.isInteger(total) || total < 0 || !Number.isInteger(maximum) || maximum < 1) throw new Error('Invalid batch parameters')
  const result: number[] = []
  for (let remaining = total; remaining > 0; remaining -= maximum) result.push(Math.min(maximum, remaining))
  return result
}

export function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0]
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  }
  if (isIP(normalized) === 6) {
    if (normalized === '::' || normalized === '::1') return true
    if (normalized.startsWith('fc') || normalized.startsWith('fd') || /^fe[89ab]/.test(normalized)) return true
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateAddress(mapped[1])
    const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
    if (mappedHex) {
      const high = parseInt(mappedHex[1], 16)
      const low = parseInt(mappedHex[2], 16)
      return isPrivateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
    }
    return !['2', '3'].includes(normalized[0])
  }
  return true
}

function cleanString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const clean = value.replace(/\0/g, '').trim()
  return clean && clean.length <= max ? clean : undefined
}

export function validateGeneratedItems(value: unknown, expected: number, kind: 'flashcard' | 'question'): GeneratedItem[] | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = (value as { items?: unknown }).items
  if (!Array.isArray(raw) || raw.length !== expected) return undefined
  const result: GeneratedItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return undefined
    const row = entry as Record<string, unknown>
    const prompt = cleanString(row.prompt, 2000)
    const answer = cleanString(row.answer, 4000)
    const explanation = cleanString(row.explanation, 6000)
    const options = Array.isArray(row.options) ? row.options.map(option => cleanString(option, 500)) : []
    const tags = Array.isArray(row.tags) ? row.tags.map(tag => cleanString(tag, 80)) : []
    if (row.kind !== kind || !prompt || !answer || !explanation || options.some(x => !x) || tags.some(x => !x) || tags.length > 10) return undefined
    if (kind === 'question' && (options.length !== 4 || new Set(options).size !== 4 || !options.includes(answer))) return undefined
    if (kind === 'flashcard' && options.length !== 0) return undefined
    result.push({ kind, prompt, answer, explanation, options: options as string[], tags: tags as string[] })
  }
  return result
}

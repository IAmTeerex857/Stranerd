import { supabase } from './supabase'
import type { MaterialFlashcard, MaterialImageMetadata, MaterialMarkdownPart, MaterialMnemonic, MaterialQuestion, MaterialQuestionGrade, MaterialSection, MaterialSectionSummary, MaterialSubject } from '../types/materials'

export const MATERIAL_PAGE_SIZE = 500
export const MATERIAL_ASSET_METADATA_LIMIT = 2000
const mnemonicPattern = /^:::mnemonic\{#([A-Za-z0-9._:-]+)\}\s*\n[\s\S]*?^:::\s*$/gm
const clozePattern = /\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}/g

function plainFlashcardText(value: string) {
  return value.replace(clozePattern, '$1').split(/\r?\n/).map((line) => line.replace(/^\s{0,3}#{1,6}\s*/, '').replace(/^\s*(?:[-+*•▪◦]|\d+[.)])\s+/, '').trim()).filter(Boolean).join('; ').replace(/(?:\*\*\*|___|\*\*|__|\*|_|`|~~)/g, '').replace(/\s+/g, ' ').trim()
}

export function parseMaterialMarkdown(markdown: string): MaterialMarkdownPart[] {
  const parts: MaterialMarkdownPart[] = []
  let start = 0
  for (const match of markdown.matchAll(mnemonicPattern)) {
    if (match.index! > start) parts.push({ kind: 'markdown', content: markdown.slice(start, match.index) })
    parts.push({ kind: 'mnemonic', id: match[1] })
    start = match.index! + match[0].length
  }
  if (start < markdown.length) parts.push({ kind: 'markdown', content: markdown.slice(start) })
  return parts
}

export function isHeadingOnlyMaterialSection(markdown: string) {
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, '')
  if (/<!--|-->|!\[|<\/?[A-Za-z]/.test(withoutComments)) return false
  const lines = withoutComments.split(/\r?\n/).filter((line) => line.trim()).map((line) => line.trimEnd())
  if (!lines.length) return false

  let headingCount = 0
  for (let index = 0; index < lines.length; index += 1) {
    const atx = lines[index].match(/^ {0,3}#{1,6}(?:[ \t]+(.+?)[ \t]*#*|[ \t]*)$/)
    if (atx) {
      if (!atx[1]?.trim()) return false
      headingCount += 1
      continue
    }
    if (index + 1 < lines.length && /^ {0,3}(?:=+|-+)$/.test(lines[index + 1]) && /^ {0,3}[\p{L}\p{N}][^<>]*$/u.test(lines[index])) {
      headingCount += 1
      index += 1
      continue
    }
    return false
  }
  return headingCount > 0
}

export function safeMaterialUrl(url: string) {
  if ((url.startsWith('/') && !url.startsWith('//')) || url.startsWith('#')) return url
  try {
    const parsed = new URL(url)
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : undefined
  } catch { return undefined }
}

export function materialFlashcardFace(card: Pick<MaterialFlashcard, 'type' | 'front' | 'back'>, revealed: boolean) {
  return plainFlashcardText(revealed ? card.back : card.front)
}

export async function collectPaginated<T>(fetchPage: (from: number, to: number) => Promise<T[]>, pageSize = MATERIAL_PAGE_SIZE): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1)
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

type CatalogRow = Record<string, unknown>

function text(value: unknown) { return typeof value === 'string' ? value : '' }
function integer(value: unknown) { return Number.isInteger(value) ? Number(value) : 0 }
function stringArray(value: unknown) { return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [] }

export function mapMaterialAssetMetadata(row: CatalogRow): [string, MaterialImageMetadata] | null {
  const url = text(row.url)
  const width = integer(row.width)
  const height = integer(row.height)
  const srcSet = text(row.srcSet)
  return url && width > 0 && height > 0 && srcSet ? [url, { width, height, srcSet }] : null
}

export function materialTitle(value: string) {
  return value.replace(/^\s*\d+\s*[.)-]\s*/, '').trim()
}

export function mapMaterialSubject(row: CatalogRow): MaterialSubject {
  return {
    id: text(row.id), slug: text(row.slug), title: text(row.title), releaseId: text(row.release_id),
    contentVersion: text(row.content_hash) || '1', publishedAt: typeof row.published_at === 'string' ? row.published_at : null,
    counts: { sections: integer(row.section_count), mnemonics: integer(row.mnemonic_count), flashcards: integer(row.flashcard_count), questions: integer(row.question_count) },
  }
}

export function mapMaterialQuestion(row: CatalogRow): MaterialQuestion | null {
  if (row.published !== true || row.review_status !== 'approved') return null
  const source = row.options && typeof row.options === 'object' && !Array.isArray(row.options) ? row.options as Record<string, unknown> : {}
  const options = ['A', 'B', 'C', 'D'].map((key) => text(source[key])) as [string, string, string, string]
  const answerIndex = ['A', 'B', 'C', 'D'].indexOf(text(row.answer))
  if (!text(row.stable_id) || options.some((option) => !option) || answerIndex < 0) return null
  const question = text(row.question).replace(/^\s*(?:question\s*)?\d+\s*[.)-]\s*/i, '')
  return { id: text(row.stable_id), ordinal: integer(row.ordinal), question, options, answerIndex, explanation: text(row.explanation), chapter: text(row.chapter), section: text(row.section) }
}

export function mapMaterialFlashcard(row: CatalogRow): MaterialFlashcard {
  const rawFront = text(row.front)
  const rawBack = text(row.back)
  const leadingCloze = rawFront.match(/^\s*\{\{c\d+::([\s\S]*?)(?:::[\s\S]*?)?\}\}\s*:\s*([\s\S]+)$/)
  const front = leadingCloze ? `Which term matches this description? ${plainFlashcardText(leadingCloze[2])}` : plainFlashcardText(rawFront)
  const back = leadingCloze ? plainFlashcardText(leadingCloze[1]) : plainFlashcardText(rawBack)
  return { id: text(row.stable_id), ordinal: integer(row.ordinal), type: 'basic', front, back, section: text(row.section) || null, tags: stringArray(row.tags) }
}

function requireClient() {
  if (!supabase) throw new Error('Materials are unavailable because Supabase is not configured.')
  return supabase
}

async function materialRequest<T>(action: string, releaseId: string, init?: RequestInit): Promise<T> {
  const client = requireClient()
  const { data, error } = await client.auth.getSession()
  if (error || !data.session) throw new Error('Sign in to access learning materials.')
  const response = await fetch(`/api/materials?action=${encodeURIComponent(action)}&releaseId=${encodeURIComponent(releaseId)}`, {
    ...init,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...init?.headers },
  })
  const result = await response.json().catch(() => ({})) as T & { message?: string }
  if (!response.ok) throw new Error(result.message || 'Learning materials could not be loaded.')
  return result
}

type NotesBundle = { sections: CatalogRow[]; mnemonics: CatalogRow[]; assets: CatalogRow[] }
const notesCache = new Map<string, { expiresAt: number; promise: Promise<NotesBundle> }>()

function materialNotes(releaseId: string) {
  const cached = notesCache.get(releaseId)
  if (cached && cached.expiresAt > Date.now()) return cached.promise
  const promise = materialRequest<NotesBundle>('notes', releaseId).catch((error) => { notesCache.delete(releaseId); throw error })
  notesCache.set(releaseId, { expiresAt: Date.now() + 3_000_000, promise })
  return promise
}

export async function listMaterialSubjects() {
  const client = requireClient()
  const rows = await collectPaginated<CatalogRow>(async (from, to) => {
    const { data, error } = await client.from('material_subject_catalog').select('*').order('title').range(from, to)
    if (error) throw error
    return (data ?? []) as CatalogRow[]
  })
  return rows.map(mapMaterialSubject)
}

export async function listMaterialSections(releaseId: string) {
  const rows = (await materialNotes(releaseId)).sections
  return rows.map((row): MaterialSectionSummary => ({ id: text(row.stable_id), ordinal: integer(row.ordinal), title: materialTitle(text(row.title)), headingPath: stringArray(row.heading_path), pageStart: integer(row.source_page_start), pageEnd: integer(row.source_page_end) }))
}

export async function getMaterialSection(releaseId: string, sectionId: string) {
  const row = (await materialNotes(releaseId)).sections.find((entry) => text(entry.stable_id) === sectionId)
  if (!row) throw new Error('This notes section is no longer available.')
  return { id: text(row.stable_id), ordinal: integer(row.ordinal), title: materialTitle(text(row.title)), headingPath: stringArray(row.heading_path), content: text(row.content), pageStart: integer(row.source_page_start), pageEnd: integer(row.source_page_end) } satisfies MaterialSection
}

export async function listMaterialMnemonics(releaseId: string) {
  const rows = (await materialNotes(releaseId)).mnemonics
  return rows.map((row): MaterialMnemonic => ({ id: text(row.stable_id), title: text(row.title), body: text(row.body), section: text(row.section) || null, sourcePage: integer(row.source_page) }))
}

export async function listMaterialAssetMetadata(releaseId: string) {
  const rows = (await materialNotes(releaseId)).assets.slice(0, MATERIAL_ASSET_METADATA_LIMIT)
  return new Map(rows.map(mapMaterialAssetMetadata).filter((entry): entry is [string, MaterialImageMetadata] => Boolean(entry)))
}

export async function listMaterialFlashcards(releaseId: string) {
  const { flashcards: rows } = await materialRequest<{ flashcards: CatalogRow[] }>('flashcards', releaseId)
  return rows.map(mapMaterialFlashcard)
}

export async function listMaterialQuestions(releaseId: string) {
  const { questions: rows } = await materialRequest<{ questions: CatalogRow[] }>('questions', releaseId)
  return rows.flatMap((row): MaterialQuestion[] => {
    const source = row.options && typeof row.options === 'object' && !Array.isArray(row.options) ? row.options as Record<string, unknown> : {}
    const options = ['A', 'B', 'C', 'D'].map((key) => text(source[key])) as [string, string, string, string]
    if (!text(row.stable_id) || options.some((option) => !option)) return []
    return [{ id: text(row.stable_id), ordinal: integer(row.ordinal), question: text(row.question).replace(/^\s*(?:question\s*)?\d+\s*[.)-]\s*/i, ''), options, chapter: text(row.chapter), section: text(row.section) } as MaterialQuestion]
  })
}

export async function submitMaterialQuestions(releaseId: string, answers: Record<string, number>) {
  return materialRequest<{ score: number; results: MaterialQuestionGrade[] }>('grade', releaseId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) })
}

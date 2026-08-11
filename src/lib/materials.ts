import { supabase } from './supabase'
import type { MaterialFlashcard, MaterialMarkdownPart, MaterialMnemonic, MaterialQuestion, MaterialSection, MaterialSectionSummary, MaterialSubject } from '../types/materials'

export const MATERIAL_PAGE_SIZE = 500
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
  return { id: text(row.stable_id), ordinal: integer(row.ordinal), question: text(row.question), options, answerIndex, explanation: text(row.explanation), chapter: text(row.chapter), section: text(row.section) }
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
  const client = requireClient()
  const rows = await collectPaginated<CatalogRow>(async (from, to) => {
    const { data, error } = await client.from('material_sections').select('stable_id,ordinal,title,heading_path,source_page_start,source_page_end').eq('release_id', releaseId).order('ordinal').range(from, to)
    if (error) throw error
    return (data ?? []) as CatalogRow[]
  })
  return rows.map((row): MaterialSectionSummary => ({ id: text(row.stable_id), ordinal: integer(row.ordinal), title: text(row.title), headingPath: stringArray(row.heading_path), pageStart: integer(row.source_page_start), pageEnd: integer(row.source_page_end) }))
}

export async function getMaterialSection(releaseId: string, sectionId: string) {
  const client = requireClient()
  const rows = await collectPaginated<CatalogRow>(async (from, to) => {
    const { data, error } = await client.from('material_sections').select('stable_id,ordinal,title,heading_path,content,source_page_start,source_page_end').eq('release_id', releaseId).eq('stable_id', sectionId).order('ordinal').range(from, to)
    if (error) throw error
    return (data ?? []) as CatalogRow[]
  })
  const row = rows[0]
  if (!row) throw new Error('This notes section is no longer available.')
  return { id: text(row.stable_id), ordinal: integer(row.ordinal), title: text(row.title), headingPath: stringArray(row.heading_path), content: text(row.content), pageStart: integer(row.source_page_start), pageEnd: integer(row.source_page_end) } satisfies MaterialSection
}

export async function listMaterialMnemonics(releaseId: string) {
  const client = requireClient()
  const rows = await collectPaginated<CatalogRow>(async (from, to) => {
    const { data, error } = await client.from('material_mnemonics').select('stable_id,title,body,section,source_page').eq('release_id', releaseId).order('ordinal').range(from, to)
    if (error) throw error
    return (data ?? []) as CatalogRow[]
  })
  return rows.map((row): MaterialMnemonic => ({ id: text(row.stable_id), title: text(row.title), body: text(row.body), section: text(row.section) || null, sourcePage: integer(row.source_page) }))
}

export async function listMaterialFlashcards(releaseId: string) {
  const client = requireClient()
  const rows = await collectPaginated<CatalogRow>(async (from, to) => {
    const { data, error } = await client.from('material_flashcards').select('stable_id,ordinal,card_type,front,back,section,tags').eq('release_id', releaseId).order('ordinal').range(from, to)
    if (error) throw error
    return (data ?? []) as CatalogRow[]
  })
  return rows.map(mapMaterialFlashcard)
}

export async function listMaterialQuestions(releaseId: string) {
  const client = requireClient()
  const rows = await collectPaginated<CatalogRow>(async (from, to) => {
    const { data, error } = await client.from('material_questions').select('stable_id,ordinal,question,options,answer,explanation,chapter,section,published,review_status').eq('release_id', releaseId).eq('published', true).eq('review_status', 'approved').order('ordinal').range(from, to)
    if (error) throw error
    return (data ?? []) as CatalogRow[]
  })
  return rows.map(mapMaterialQuestion).filter((row): row is MaterialQuestion => Boolean(row))
}

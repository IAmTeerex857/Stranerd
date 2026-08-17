import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAiUser } from './aiCredits.js'

const RELEASE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SECTION_ID = /^[A-Za-z0-9._:-]{1,200}$/
const SIGNED_URL_TTL_SECONDS = 3600

export class MaterialsError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

type DbError = { message?: string } | null
type AssetRow = { public_url: string; storage_path: string; metadata: Record<string, unknown> | null }

async function collectRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: DbError }>) {
  const rows: T[] = []
  const pageSize = 500
  for (let from = 0; ; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1)
    if (result.error) databaseError(result.error)
    const page = result.data || []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

function databaseError(error: DbError): never {
  console.error('Materials database request failed:', error?.message || 'unknown error')
  throw new MaterialsError(500, 'materials_failed', 'Learning materials could not be loaded.')
}

export function materialsErrorResponse(error: unknown) {
  if (error instanceof MaterialsError) return { status: error.status, body: { error: error.code, message: error.message } }
  if (error && typeof error === 'object' && 'status' in error && Number(error.status) === 401) {
    return { status: 401, body: { error: 'authentication_required', message: 'Sign in to access learning materials.' } }
  }
  console.error('Materials request failed:', error instanceof Error ? error.message : error)
  return { status: 500, body: { error: 'internal_error', message: 'Learning materials could not be loaded.' } }
}

function validReleaseId(releaseId: string) {
  if (!RELEASE_ID.test(releaseId)) throw new MaterialsError(400, 'invalid_release_id', 'A valid material release is required.')
}

async function materialsUser(authorization?: string) {
  return requireAiUser(authorization)
}

async function requirePublishedRelease(client: SupabaseClient, releaseId: string) {
  validReleaseId(releaseId)
  const { data, error } = await client.from('material_releases').select('id').eq('id', releaseId).eq('status', 'published').maybeSingle()
  if (error) databaseError(error)
  if (!data) throw new MaterialsError(404, 'release_not_found', 'This material release is unavailable.')
}

function derivatives(row: AssetRow) {
  const values = Array.isArray(row.metadata?.derivatives) ? row.metadata.derivatives : []
  return values.flatMap((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    const item = value as Record<string, unknown>
    return typeof item.storagePath === 'string' && typeof item.publicUrl === 'string' && Number.isInteger(item.width)
      ? [{ storagePath: item.storagePath, sourceUrl: item.publicUrl, width: Number(item.width) }]
      : []
  })
}

async function signedAssets(client: SupabaseClient, rows: AssetRow[]) {
  const paths = rows.flatMap((row) => [row.storage_path, ...derivatives(row).map((item) => item.storagePath)])
  if (!paths.length) return { replacements: new Map<string, string>(), assets: [] }
  const { data, error } = await client.storage.from('materials').createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
  if (error) databaseError(error)
  const signedByPath = new Map((data || []).map((item) => [item.path, item.signedUrl]))
  const replacements = new Map<string, string>()
  const assets = rows.flatMap((row) => {
    const url = signedByPath.get(row.storage_path)
    if (!url) return []
    replacements.set(row.public_url, url)
    for (const item of derivatives(row)) {
      const signedUrl = signedByPath.get(item.storagePath)
      if (signedUrl) replacements.set(item.sourceUrl, signedUrl)
    }
    const width = Number(row.metadata?.width)
    const height = Number(row.metadata?.height)
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) return []
    const candidates = derivatives(row).flatMap((item) => {
      const signedUrl = signedByPath.get(item.storagePath)
      if (!signedUrl || item.width <= 0 || item.width >= width) return []
      return [{ url: signedUrl, width: item.width }]
    })
    candidates.push({ url, width })
    return [{ url, width, height, srcSet: [...new Map(candidates.map((item) => [item.width, item])).values()].sort((a, b) => a.width - b.width).map((item) => `${item.url} ${item.width}w`).join(', ') }]
  })
  return { replacements, assets }
}

function replaceAssetUrls(value: string, replacements: ReadonlyMap<string, string>) {
  let result = value
  for (const [source, signed] of replacements) result = result.replaceAll(source, signed)
  return result
}

export async function getMaterialNotes(authorization: string | undefined, releaseId: string) {
  const { client } = await materialsUser(authorization)
  await requirePublishedRelease(client, releaseId)
  const [sections, mnemonics, assets] = await Promise.all([
    collectRows((from, to) => client.from('material_sections').select('stable_id,ordinal,title,heading_path,content,source_page_start,source_page_end').eq('release_id', releaseId).order('ordinal').range(from, to)),
    collectRows((from, to) => client.from('material_mnemonics').select('stable_id,ordinal,title,body,section,source_page').eq('release_id', releaseId).order('ordinal').range(from, to)),
    client.from('material_assets').select('public_url,storage_path,metadata').eq('release_id', releaseId).order('storage_path').limit(2000),
  ])
  if (assets.error) databaseError(assets.error)
  const signed = await signedAssets(client, (assets.data || []) as AssetRow[])
  return {
    sections: sections.map((row) => ({ ...row, content: replaceAssetUrls(row.content, signed.replacements) })),
    mnemonics: mnemonics.map((row) => ({ ...row, body: replaceAssetUrls(row.body, signed.replacements) })),
    assets: signed.assets,
  }
}

export async function getMaterialFlashcards(authorization: string | undefined, releaseId: string) {
  const { client } = await materialsUser(authorization)
  await requirePublishedRelease(client, releaseId)
  const flashcards = await collectRows((from, to) => client.from('material_flashcards').select('stable_id,ordinal,card_type,front,back,section,tags').eq('release_id', releaseId).order('ordinal').range(from, to))
  return { flashcards }
}

export async function getMaterialQuestions(authorization: string | undefined, releaseId: string) {
  const { client } = await materialsUser(authorization)
  await requirePublishedRelease(client, releaseId)
  const { data, error } = await client.from('material_questions').select('stable_id,ordinal,question,options,chapter,section').eq('release_id', releaseId).eq('published', true).eq('review_status', 'approved').order('ordinal').limit(20)
  if (error) databaseError(error)
  return { questions: data || [] }
}

export async function gradeMaterialQuestions(authorization: string | undefined, releaseId: string, rawAnswers: unknown) {
  const { client } = await materialsUser(authorization)
  await requirePublishedRelease(client, releaseId)
  if (!rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) throw new MaterialsError(400, 'invalid_answers', 'Submit one answer for every question.')
  const answers = rawAnswers as Record<string, unknown>
  const { data, error } = await client.from('material_questions').select('stable_id,ordinal,options,answer,explanation').eq('release_id', releaseId).eq('published', true).eq('review_status', 'approved').order('ordinal').limit(20)
  if (error) databaseError(error)
  const rows = data || []
  if (rows.length !== 20 || Object.keys(answers).length !== rows.length || rows.some((row) => !SECTION_ID.test(row.stable_id) || !Number.isInteger(answers[row.stable_id]) || Number(answers[row.stable_id]) < 0 || Number(answers[row.stable_id]) > 3)) {
    throw new MaterialsError(400, 'invalid_answers', 'Submit one valid answer for every question.')
  }
  const keys = ['A', 'B', 'C', 'D']
  const results = rows.map((row) => ({ id: row.stable_id, answerIndex: keys.indexOf(row.answer), explanation: row.explanation }))
  if (results.some((result) => result.answerIndex < 0)) throw new MaterialsError(500, 'invalid_material', 'Stored material answers are invalid.')
  return { score: results.filter((result) => answers[result.id] === result.answerIndex).length, results }
}

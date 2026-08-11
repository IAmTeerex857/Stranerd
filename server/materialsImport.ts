import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import 'dotenv/config'
import { curateImportedFlashcards, curateImportedQuestions, MATERIALS_EDITORIAL_VERSION } from './materialsEditorial.js'

const REQUIRED_FILES = ['notes.md', 'sections.jsonl', 'figures.json', 'mnemonics.json', 'flashcards.json', 'tests.generated.json'] as const
const SUBJECT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const LOCAL_IMAGE_RE = /(?<!\\)(!\[(?:\\.|[^\]\\])*\]\(\s*)(\.\/assets\/([^\s)'"<>]+))(?=(?:\s+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\((?:\\.|[^)\\])*\)))?\s*\))/g

type JsonObject = Record<string, unknown>
type QuestionStatus = 'pending' | 'approved' | 'rejected'

export interface MaterialAsset {
  id: string
  originalPath: string
  fileName: string
  absolutePath: string
  storagePath: string
  publicUrl: string
  sha256: string
  byteSize: number
  mimeType: 'image/png' | 'image/jpeg'
}

export interface SubjectManifest {
  subject: { id: string; slug: string; title: string }
  release: { id: string; corpusHash: string; contentHash: string; notesMarkdown: string; sourceMetadata: JsonObject }
  sections: JsonObject[]
  assets: MaterialAsset[]
  figures: JsonObject[]
  mnemonics: JsonObject[]
  flashcards: JsonObject[]
  questions: JsonObject[]
  counts: Record<string, number>
}

export interface CorpusManifest {
  corpusHash: string
  subjects: SubjectManifest[]
  counts: Record<string, number>
}

export interface BuildManifestOptions {
  outputRoot: string
  publicBaseUrl?: string
  approveQuestions?: boolean
  subjects?: string[]
}

function fail(message: string): never {
  throw new Error(`Materials import: ${message}`)
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

function stableUuid(...parts: string[]): string {
  const hex = sha256(parts.join('\x1f')).slice(0, 32).split('')
  hex[12] = '5'
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as JsonObject).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function objectAt(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`)
  return value as JsonObject
}

function stringAt(value: JsonObject, key: string, label: string, allowEmpty = false): string {
  const item = value[key]
  if (typeof item !== 'string' || (!allowEmpty && !item.trim())) fail(`${label}.${key} must be a non-empty string`)
  return item
}

function integerAt(value: JsonObject, key: string, label: string): number {
  const item = value[key]
  if (!Number.isInteger(item)) fail(`${label}.${key} must be an integer`)
  return item as number
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'))
  } catch (error) {
    fail(`${file} is malformed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function readJsonArray(file: string): Promise<JsonObject[]> {
  const value = await readJson(file)
  if (!Array.isArray(value)) fail(`${file} must contain an array`)
  return value.map((item, index) => objectAt(item, `${file}[${index}]`))
}

async function readJsonLines(file: string): Promise<JsonObject[]> {
  const source = await fs.readFile(file, 'utf8')
  const result: JsonObject[] = []
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.trim()) continue
    try {
      result.push(objectAt(JSON.parse(line), `${file}:${index + 1}`))
    } catch (error) {
      fail(`${file}:${index + 1} is malformed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (!result.length) fail(`${file} is empty`)
  return result
}

function safeAssetName(originalPath: string, label: string): string {
  if (!originalPath.startsWith('./assets/')) fail(`${label} is not rooted at ./assets/`)
  const encodedName = originalPath.slice('./assets/'.length)
  let name: string
  try {
    name = decodeURIComponent(encodedName)
  } catch {
    fail(`${label} contains malformed URL encoding`)
  }
  if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..' || name.includes('\0')) {
    fail(`${label} contains path traversal or a nested path`)
  }
  return name
}

export function rewriteMarkdownAssetUrls(markdown: string, urls: ReadonlyMap<string, string>): string {
  const codeRanges: Array<[number, number]> = []
  let fence: string | undefined
  let lineStart = 0
  for (const line of markdown.match(/.*(?:\n|$)/g) ?? []) {
    if (!line) continue
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1]
    if (fence) {
      codeRanges.push([lineStart, lineStart + line.length])
      if (marker?.[0] === fence[0] && marker.length >= fence.length) fence = undefined
    } else if (marker) {
      fence = marker
      codeRanges.push([lineStart, lineStart + line.length])
    } else {
      for (const opening of line.matchAll(/`+/g)) {
        const start = opening.index
        const closing = line.indexOf(opening[0], start + opening[0].length)
        if (closing >= 0) codeRanges.push([lineStart + start, lineStart + closing + opening[0].length])
      }
    }
    lineStart += line.length
  }
  return markdown.replace(LOCAL_IMAGE_RE, (match, prefix: string, originalPath: string, _fileName: string, offset: number) => {
    if (codeRanges.some(([start, end]) => offset >= start && offset < end)) return match
    safeAssetName(originalPath, `Markdown image ${originalPath}`)
    const replacement = urls.get(originalPath)
    if (!replacement) fail(`Markdown references missing asset ${originalPath}`)
    return `${prefix}${replacement}`
  })
}

function markdownAssetPaths(markdown: string): string[] {
  const paths: string[] = []
  for (const match of markdown.matchAll(LOCAL_IMAGE_RE)) paths.push(match[2])
  return paths
}

function titleFromSlug(slug: string): string {
  return slug.split('-').map((word) => word === 'and' ? '&' : `${word[0].toUpperCase()}${word.slice(1)}`).join(' ')
}

function validateIdentity(record: JsonObject, subject: string, label: string): string {
  const id = stringAt(record, 'id', label)
  if (record.subject !== subject) fail(`${label}.subject does not match ${subject}`)
  return id
}

function uniqueIds(records: JsonObject[], subject: string, kind: string): void {
  const seen = new Set<string>()
  records.forEach((record, index) => {
    const id = validateIdentity(record, subject, `${subject}/${kind}[${index}]`)
    if (seen.has(id)) fail(`${subject}/${kind} has duplicate id ${id}`)
    seen.add(id)
  })
}

function mimeFor(name: string, bytes: Uint8Array): 'image/png' | 'image/jpeg' {
  const png = bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const extension = path.extname(name).toLowerCase()
  if (png && extension === '.png') return 'image/png'
  if (jpeg && (extension === '.jpg' || extension === '.jpeg')) return 'image/jpeg'
  fail(`${name} is not a PNG/JPEG matching its extension`)
}

async function sourceSubject(subjectDir: string, subject: string): Promise<{
  raw: Record<string, string>; sections: JsonObject[]; figures: JsonObject[]; mnemonics: JsonObject[]; flashcards: JsonObject[]; questions: JsonObject[]; assets: Omit<MaterialAsset, 'id' | 'storagePath' | 'publicUrl'>[]; contentHash: string
}> {
  for (const file of REQUIRED_FILES) {
    try { await fs.access(path.join(subjectDir, file)) } catch { fail(`${subject} is missing ${file}`) }
  }
  const raw: Record<string, string> = {}
  await Promise.all(REQUIRED_FILES.map(async (file) => { raw[file] = await fs.readFile(path.join(subjectDir, file), 'utf8') }))
  const [sections, figuresInput, mnemonics, flashcards, questions] = await Promise.all([
    readJsonLines(path.join(subjectDir, 'sections.jsonl')),
    readJsonArray(path.join(subjectDir, 'figures.json')),
    readJsonArray(path.join(subjectDir, 'mnemonics.json')),
    readJsonArray(path.join(subjectDir, 'flashcards.json')),
    readJsonArray(path.join(subjectDir, 'tests.generated.json')),
  ])
  uniqueIds(sections, subject, 'sections')
  uniqueIds(mnemonics, subject, 'mnemonics')
  uniqueIds(flashcards, subject, 'flashcards')
  uniqueIds(questions, subject, 'questions')

  sections.forEach((item, index) => {
    stringAt(item, 'content', `${subject}/sections[${index}]`)
    stringAt(item, 'title', `${subject}/sections[${index}]`)
    integerAt(item, 'source_page_start', `${subject}/sections[${index}]`)
    integerAt(item, 'source_page_end', `${subject}/sections[${index}]`)
    if (!Array.isArray(item.heading_path)) fail(`${subject}/sections[${index}].heading_path must be an array`)
  })
  mnemonics.forEach((item, index) => {
    stringAt(item, 'title', `${subject}/mnemonics[${index}]`)
    stringAt(item, 'body', `${subject}/mnemonics[${index}]`)
    integerAt(item, 'source_page', `${subject}/mnemonics[${index}]`)
  })
  flashcards.forEach((item, index) => {
    if (item.type !== 'basic' && item.type !== 'cloze') fail(`${subject}/flashcards[${index}].type is unsupported`)
    stringAt(item, 'front', `${subject}/flashcards[${index}]`)
    stringAt(item, 'back', `${subject}/flashcards[${index}]`)
    integerAt(item, 'source_page', `${subject}/flashcards[${index}]`)
  })
  questions.forEach((item, index) => {
    const label = `${subject}/questions[${index}]`
    for (const field of ['question', 'answer', 'explanation', 'chapter', 'section', 'evidence_quote']) stringAt(item, field, label)
    integerAt(item, 'source_page', label)
    const options = objectAt(item.options, `${label}.options`)
    if (canonical(Object.keys(options).sort()) !== canonical(['A', 'B', 'C', 'D']) || !Object.values(options).every((option) => typeof option === 'string' && option.trim())) fail(`${label}.options must contain non-empty A-D values`)
    if (!['A', 'B', 'C', 'D'].includes(item.answer as string)) fail(`${label}.answer must be A-D`)
    const review = objectAt(item.review, `${label}.review`)
    if (!['pending', 'approved', 'rejected'].includes(review.status as string)) fail(`${label}.review.status is invalid`)
  })

  const figureSeen = new Set<string>()
  const figures = figuresInput.filter((figure, index) => {
    const label = `${subject}/figures[${index}]`
    const file = stringAt(figure, 'file', label)
    safeAssetName(file, `${label}.file`)
    integerAt(figure, 'page', label)
    const key = canonical(figure)
    if (figureSeen.has(key)) return false
    figureSeen.add(key)
    return true
  })
  const referenced = new Set([...markdownAssetPaths(raw['notes.md']), ...sections.flatMap((section) => markdownAssetPaths(section.content as string)), ...figures.map((figure) => figure.file as string)])
  const diskEntries = (await fs.readdir(path.join(subjectDir, 'assets'), { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name).sort()
  const referencedNames = [...referenced].map((item) => safeAssetName(item, `${subject} asset reference`)).sort()
  if (canonical(diskEntries) !== canonical([...new Set(referencedNames)].sort())) fail(`${subject}/assets has stale or missing files`)
  const assets = await Promise.all([...referenced].sort().map(async (originalPath) => {
    const fileName = safeAssetName(originalPath, `${subject} asset reference`)
    const absolutePath = path.resolve(subjectDir, 'assets', fileName)
    if (path.dirname(absolutePath) !== path.resolve(subjectDir, 'assets')) fail(`${originalPath} escapes assets directory`)
    const bytes = await fs.readFile(absolutePath)
    return { originalPath, fileName, absolutePath, sha256: sha256(bytes), byteSize: bytes.byteLength, mimeType: mimeFor(fileName, bytes) }
  }))
  const contentHash = sha256(canonical({ files: Object.fromEntries(REQUIRED_FILES.map((file) => [file, sha256(raw[file])])), assets: assets.map((asset) => [asset.originalPath, asset.sha256]) }))
  return { raw, sections, figures, mnemonics, flashcards, questions, assets, contentHash }
}

export async function buildMaterialsManifest(options: BuildManifestOptions): Promise<CorpusManifest> {
  const outputRoot = path.resolve(options.outputRoot)
  const entries = await fs.readdir(outputRoot, { withFileTypes: true })
  let subjects = entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => entry.name).sort()
  if (options.subjects?.length) {
    const wanted = new Set(options.subjects)
    subjects = subjects.filter((subject) => wanted.has(subject))
    for (const subject of wanted) if (!subjects.includes(subject)) fail(`unknown subject ${subject}`)
  }
  if (!subjects.length) fail(`no subjects found in ${outputRoot}`)
  for (const subject of subjects) if (!SUBJECT_RE.test(subject)) fail(`invalid subject directory ${subject}`)
  const sources = await Promise.all(subjects.map((subject) => sourceSubject(path.join(outputRoot, subject), subject)))
  const flashcardSeen = new Set<string>()
  const curatedFlashcards = sources.map((source) => curateImportedFlashcards(source.flashcards, flashcardSeen))
  const curatedQuestions = sources.map((source) => curateImportedQuestions(source.questions))
  const flashcardHashes = curatedFlashcards.map((cards) => sha256(canonical(cards)))
  const questionHashes = curatedQuestions.map((questions) => sha256(canonical(questions)))
  const corpusHash = sha256(canonical({ editorialVersion: MATERIALS_EDITORIAL_VERSION, subjects: subjects.map((subject, index) => [subject, sources[index].contentHash, flashcardHashes[index], questionHashes[index]]) }))
  const publicBase = (options.publicBaseUrl ?? 'https://dry-run.invalid/storage/v1/object/public/materials').replace(/\/$/, '')
  const manifests = sources.map((source, index): SubjectManifest => {
    const subject = subjects[index]
    const publicationHash = sha256(canonical({ sourceContentHash: source.contentHash, corpusHash, editorialVersion: MATERIALS_EDITORIAL_VERSION, questionsApprovedByImport: Boolean(options.approveQuestions) }))
    const urls = new Map<string, string>()
    const assets = source.assets.map((asset) => {
      const storagePath = `assets/${asset.sha256}/${asset.fileName}`
      const publicUrl = `${publicBase}/assets/${asset.sha256}/${encodeURIComponent(asset.fileName)}`
      urls.set(asset.originalPath, publicUrl)
      return { ...asset, id: stableUuid('asset', subject, asset.sha256), storagePath, publicUrl }
    })
    const rewriteRecord = (record: JsonObject, fields: string[]) => Object.fromEntries(Object.entries(record).map(([key, value]) => [key, fields.includes(key) && typeof value === 'string' ? rewriteMarkdownAssetUrls(value, urls) : value]))
    const sections = source.sections.map((record) => rewriteRecord(record, ['content']))
    const mnemonics = source.mnemonics.map((record) => rewriteRecord(record, ['title', 'body']))
    const flashcards = curatedFlashcards[index].map((record) => rewriteRecord(record, ['front', 'back', 'figure']))
    const questions = curatedQuestions[index].map((sourceRecord) => {
      const record = rewriteRecord(sourceRecord, ['question', 'explanation', 'evidence_quote'])
      return { ...record, status: options.approveQuestions ? 'approved' : (objectAt(record.review, `${subject} question review`).status as QuestionStatus), published: options.approveQuestions || objectAt(record.review, `${subject} question review`).status === 'approved', original_metadata: { review: record.review, needs_review: record.needs_review } }
    })
    const figures = source.figures.map((record, placement) => ({ ...record, id: stableUuid('figure', subject, canonical(record)), asset_id: assets.find((asset) => asset.originalPath === record.file)?.id, original_path: record.file, public_url: urls.get(record.file as string), placement }))
    const counts = { sections: sections.length, assets: assets.length, figures: figures.length, mnemonics: source.mnemonics.length, flashcards: flashcards.length, questions: questions.length, approvedQuestions: questions.filter((item) => item.status === 'approved' && item.published).length }
    return {
      subject: { id: stableUuid('subject', subject), slug: subject, title: titleFromSlug(subject) },
      release: { id: stableUuid('release', subject, publicationHash), corpusHash, contentHash: publicationHash, notesMarkdown: rewriteMarkdownAssetUrls(source.raw['notes.md'], urls), sourceMetadata: { source_directory: subject, source_content_hash: source.contentHash, editorial_version: MATERIALS_EDITORIAL_VERSION, flashcards_editorial_hash: flashcardHashes[index], questions_editorial_hash: questionHashes[index], questions_approved_by_import: Boolean(options.approveQuestions), original_asset_paths: Object.fromEntries(assets.map((asset) => [asset.id, asset.originalPath])) } },
      sections, assets, figures, mnemonics, flashcards, questions, counts,
    }
  })
  const counts = manifests.reduce<Record<string, number>>((total, item) => { for (const [key, count] of Object.entries(item.counts)) total[key] = (total[key] ?? 0) + count; return total }, { subjects: manifests.length })
  return { corpusHash, subjects: manifests, counts }
}

export function subjectRpcPayload(manifest: SubjectManifest, runId: string, expectedSubjects: number): JsonObject {
  return {
    run_id: runId, expected_subjects: expectedSubjects, subject: manifest.subject, release: manifest.release,
    sections: manifest.sections,
    assets: manifest.assets.map((asset) => ({ id: asset.id, originalPath: asset.originalPath, fileName: asset.fileName, storagePath: asset.storagePath, publicUrl: asset.publicUrl, sha256: asset.sha256, byteSize: asset.byteSize, mimeType: asset.mimeType })),
    figures: manifest.figures, mnemonics: manifest.mnemonics, flashcards: manifest.flashcards, questions: manifest.questions,
  }
}

async function uploadAssets(client: SupabaseClient, assets: MaterialAsset[]): Promise<{ uploaded: number; existing: number }> {
  let uploaded = 0
  let existing = 0
  for (let offset = 0; offset < assets.length; offset += 4) {
    await Promise.all(assets.slice(offset, offset + 4).map(async (asset) => {
      const bytes = await fs.readFile(asset.absolutePath)
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        const { error } = await client.storage.from('materials').upload(asset.storagePath, bytes, { contentType: asset.mimeType, cacheControl: '31536000', upsert: false })
        if (!error) { uploaded += 1; return }
        if (/exist|duplicate|conflict/i.test(error.message)) { existing += 1; return }
        if (attempt === 3) fail(`upload ${asset.storagePath}: ${error.message}`)
        await new Promise((resolve) => setTimeout(resolve, attempt * 750))
      }
    }))
  }
  return { uploaded, existing }
}

export async function applyMaterialsManifest(manifest: CorpusManifest, supabaseUrl: string, serviceKey: string): Promise<Record<string, number>> {
  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const runId = stableUuid('run', manifest.corpusHash)
  const { data: priorRun, error: priorRunError } = await client.from('material_import_runs').select('status').eq('id', runId).maybeSingle()
  if (priorRunError) fail(`check import run: ${priorRunError.message}`)
  if (priorRun?.status === 'completed') return { uploaded: 0, existing: manifest.counts.assets ?? 0, published: manifest.subjects.length }
  const result = { uploaded: 0, existing: 0, published: 0 }
  for (const subject of manifest.subjects) {
    const uploads = await uploadAssets(client, subject.assets)
    result.uploaded += uploads.uploaded
    result.existing += uploads.existing
    const { error } = await client.rpc('import_materials_subject', { p_payload: subjectRpcPayload(subject, runId, manifest.subjects.length) })
    if (error) fail(`publish ${subject.subject.slug}: ${error.message}`)
    result.published += 1
  }
  const { error: finalizeError } = await client.rpc('finalize_materials_import', { p_run_id: runId })
  if (finalizeError) fail(`finalize corpus: ${finalizeError.message}`)
  return result
}

async function pagedRows(client: SupabaseClient, table: string, releaseId: string): Promise<JsonObject[]> {
  const rows: JsonObject[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select('*').eq('release_id', releaseId).range(from, from + 999)
    if (error) fail(`verify ${table}: ${error.message}`)
    rows.push(...((data ?? []) as JsonObject[]))
    if (!data || data.length < 1000) return rows
  }
}

export async function verifyMaterialsManifest(manifest: CorpusManifest, supabaseUrl: string, serviceKey: string): Promise<Record<string, number>> {
  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const verified = { subjects: 0, assets: 0, sampledAssets: 0 }
  const runId = stableUuid('run', manifest.corpusHash)
  const { data: run, error: runError } = await client.from('material_import_runs').select('status,expected_subjects,imported_subjects').eq('id', runId).single()
  if (runError || run?.status !== 'completed' || run.expected_subjects !== manifest.subjects.length || !Array.isArray(run.imported_subjects) || run.imported_subjects.length !== manifest.subjects.length) fail(`verify import run: ${runError?.message ?? 'incomplete or mismatched'}`)
  const { data: staged, error: stagedError } = await client.from('material_import_subjects').select('subject_slug,release_id').eq('run_id', runId)
  if (stagedError || staged?.length !== manifest.subjects.length) fail(`verify import membership: ${stagedError?.message ?? 'count differs'}`)
  for (const subject of manifest.subjects) {
    if (!staged.some((entry) => entry.subject_slug === subject.subject.slug && entry.release_id === subject.release.id)) fail(`verify ${subject.subject.slug}: import membership differs`)
    const { data: remoteSubject, error: subjectError } = await client.from('material_subjects').select('current_release_id').eq('id', subject.subject.id).single()
    if (subjectError || remoteSubject?.current_release_id !== subject.release.id) fail(`verify ${subject.subject.slug}: current release pointer differs`)
    const { data: release, error } = await client.from('material_releases').select('id,corpus_hash,content_hash,status').eq('id', subject.release.id).single()
    if (error || !release) fail(`verify ${subject.subject.slug} release: ${error?.message ?? 'missing'}`)
    if (release.corpus_hash !== manifest.corpusHash || release.content_hash !== subject.release.contentHash || release.status !== 'published') fail(`verify ${subject.subject.slug}: release hashes/status differ`)
    const tables: Array<[string, number]> = [
      ['material_sections', subject.counts.sections], ['material_assets', subject.counts.assets], ['material_figures', subject.counts.figures],
      ['material_mnemonics', subject.counts.mnemonics], ['material_flashcards', subject.counts.flashcards], ['material_questions', subject.counts.questions],
    ]
    let remoteAssets: JsonObject[] = []
    for (const [table, expected] of tables) {
      const rows = await pagedRows(client, table, subject.release.id)
      if (rows.length !== expected) fail(`verify ${subject.subject.slug}/${table}: expected ${expected}, found ${rows.length}`)
      if (table === 'material_assets') remoteAssets = rows
    }
    for (const asset of subject.assets) {
      const remoteAsset = remoteAssets.find((item) => item.storage_path === asset.storagePath)
      if (!remoteAsset || remoteAsset.sha256 !== asset.sha256 || remoteAsset.byte_size !== asset.byteSize || remoteAsset.original_path !== asset.originalPath) fail(`verify asset metadata ${asset.storagePath}: differs`)
      verified.assets += 1
    }
    verified.subjects += 1
  }
  const allAssets = manifest.subjects.flatMap((subject) => subject.assets).sort((left, right) => left.storagePath.localeCompare(right.storagePath))
  const sampleCount = Math.min(12, allAssets.length)
  const samples = Array.from({ length: sampleCount }, (_, index) => allAssets[Math.floor(index * allAssets.length / sampleCount)])
  for (const asset of samples) {
    const { data, error } = await client.storage.from('materials').download(asset.storagePath)
    if (error || !data) fail(`verify sampled asset ${asset.storagePath}: ${error?.message ?? 'missing'}`)
    if (sha256(new Uint8Array(await data.arrayBuffer())) !== asset.sha256) fail(`verify sampled asset ${asset.storagePath}: SHA-256 differs`)
    verified.sampledAssets += 1
  }
  return verified
}

export function runSourceValidation(materialsRoot: string): void {
  const python = process.env.PYTHON ?? path.join(materialsRoot, '.venv', 'bin', 'python')
  const executable = requireExecutable(python) ? python : 'python3'
  execFileSync(executable, [path.join(materialsRoot, 'scripts', 'validate.py'), path.join(materialsRoot, 'output')], { stdio: 'inherit' })
  execFileSync(executable, [path.join(materialsRoot, 'scripts', 'validate_generated.py'), '--output', path.join(materialsRoot, 'output'), '--validate-only', '--expected-tests-per-subject', '20'], { stdio: 'inherit', cwd: materialsRoot })
}

function requireExecutable(file: string): boolean {
  try { execFileSync('test', ['-x', file]); return true } catch { return false }
}

function argsValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

export async function importCli(args = process.argv.slice(2)): Promise<void> {
  const apply = args.includes('--apply')
  const dryRun = args.includes('--dry-run') || !apply
  if (apply && args.includes('--dry-run')) fail('choose either --apply or --dry-run')
  const materialsRoot = path.resolve(argsValue(args, '--materials-root') ?? 'Materials')
  if (!args.includes('--skip-source-validation')) runSourceValidation(materialsRoot)
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (apply && (!url || !key)) fail('--apply requires SUPABASE_URL and SUPABASE_SECRET_KEY')
  const manifest = await buildMaterialsManifest({ outputRoot: path.join(materialsRoot, 'output'), publicBaseUrl: url ? `${url}/storage/v1/object/public/materials` : undefined, approveQuestions: args.includes('--approve-questions'), subjects: argsValue(args, '--subject')?.split(',') })
  console.log(JSON.stringify({ mode: dryRun ? 'dry-run' : 'apply', corpusHash: manifest.corpusHash, ...manifest.counts }, null, 2))
  if (apply) console.log(JSON.stringify(await applyMaterialsManifest(manifest, url!, key!), null, 2))
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) importCli().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })

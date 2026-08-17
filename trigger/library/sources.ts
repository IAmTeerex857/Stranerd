import { formatFromExtension, toMarkdownBytes } from '@firecrawl/anydoc'
import type { Config } from './config.js'
import type { LibraryDatabase } from './database.js'
import { extractArticle } from './article.js'
import { transcribeAudio } from './ai.js'
import { PermanentJobError } from './errors.js'
import type { LibrarySource } from './types.js'
import { LIMITS } from './validation.js'

const INPUT_BUCKET = 'library-inputs'

async function downloadInput(db: LibraryDatabase, source: LibrarySource): Promise<Uint8Array> {
  if (!source.storage_path) throw new PermanentJobError('Stored source is missing its path')
  const { data, error } = await db.client.storage.from(INPUT_BUCKET).download(source.storage_path)
  if (error) throw error
  return new Uint8Array(await data.arrayBuffer())
}

export async function deleteInputs(db: LibraryDatabase, sources: LibrarySource[]): Promise<void> {
  const paths = sources.map(source => source.storage_path).filter((path): path is string => Boolean(path))
  if (!paths.length) return
  const { error } = await db.client.storage.from(INPUT_BUCKET).remove(paths)
  if (error) throw error
}

function boundedText(text: string): string {
  const clean = text.replace(/\0/g, '').trim()
  if (!clean) throw new PermanentJobError('Source contains no readable text')
  return clean.slice(0, LIMITS.maxSourceChars)
}

async function youtubeTranscript(config: Config, input: string): Promise<string> {
  let url: URL
  try { url = new URL(input) } catch { throw new PermanentJobError('YouTube URL is invalid') }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) throw new PermanentJobError('Only HTTPS YouTube video URLs are accepted')
  const endpoint = new URL('https://api.supadata.ai/v1/youtube/transcript')
  endpoint.searchParams.set('url', url.toString())
  endpoint.searchParams.set('text', 'true')
  const response = await fetch(endpoint, { headers: { 'x-api-key': config.supadataApiKey }, signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`Supadata request failed with HTTP ${response.status}`)
  const body = await response.json() as { content?: unknown }
  if (typeof body.content !== 'string') throw new PermanentJobError('Supadata returned no transcript')
  return boundedText(body.content)
}

async function extractSource(config: Config, db: LibraryDatabase, source: LibrarySource): Promise<string> {
  if (source.category === 'prompt') return boundedText(source.input_text || '')
  if (source.category === 'link') return boundedText(await extractArticle(source.source_url || ''))
  if (source.category === 'youtube') return youtubeTranscript(config, source.source_url || '')
  const maximumBytes = source.category === 'audio' ? LIMITS.maxAudioBytes : LIMITS.maxDocumentBytes
  if (source.byte_size && source.byte_size > maximumBytes) throw new PermanentJobError('Source file exceeds the 25 MB limit')
  const bytes = await downloadInput(db, source)
  if (bytes.byteLength > maximumBytes) throw new PermanentJobError('Source file exceeds the 25 MB limit')
  if (source.category === 'audio') {
    if (!source.mime_type?.startsWith('audio/')) throw new PermanentJobError('Audio source has an invalid MIME type')
    return boundedText(await transcribeAudio(config, bytes, source.file_name || 'audio', source.mime_type))
  }
  if (source.category === 'document' && ['text/markdown', 'text/x-markdown'].includes(source.mime_type || '')) {
    try { return boundedText(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { throw new PermanentJobError('Markdown must be valid UTF-8') }
  }
  if (source.category === 'document') {
    const extension = source.file_name?.split('.').pop()?.toLowerCase() || ''
    return boundedText(await toMarkdownBytes(bytes, formatFromExtension(extension)))
  }
  throw new PermanentJobError(`Unsupported source category: ${String(source.category)}`)
}

export async function ingestSources(config: Config, db: LibraryDatabase, jobId: string): Promise<{ corpus: string, sources: LibrarySource[] }> {
  const sources = await db.sources(jobId)
  if (!sources.length || sources.length > LIMITS.maxSources) throw new PermanentJobError(`A job must contain 1-${LIMITS.maxSources} sources`)
  const texts: string[] = []
  for (const source of sources) texts.push(await extractSource(config, db, source))
  const corpus = texts.join('\n\n---\n\n')
  if (corpus.length > LIMITS.maxCorpusChars) throw new PermanentJobError(`Combined source content exceeds ${LIMITS.maxCorpusChars} characters`)
  return { corpus, sources }
}

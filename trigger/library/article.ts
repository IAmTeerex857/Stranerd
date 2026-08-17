import { lookup } from 'node:dns/promises'
import { Agent, fetch } from 'undici'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import { PermanentJobError } from './errors.js'
import { isPrivateAddress, LIMITS } from './validation.js'

const MAX_REDIRECTS = 4

async function readBounded(response: Awaited<ReturnType<typeof fetch>>, maximum: number): Promise<Uint8Array> {
  if (!response.body) throw new PermanentJobError('Article response has no body')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maximum) {
      await reader.cancel()
      throw new PermanentJobError('Article exceeds the size limit')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

async function publicAddresses(hostname: string): Promise<Array<{ address: string, family: 4 | 6 }>> {
  const records = await lookup(hostname, { all: true, verbatim: true })
  if (!records.length || records.some(record => isPrivateAddress(record.address))) throw new PermanentJobError('Article host resolves to a private or disallowed address')
  return records.map(record => ({ address: record.address, family: record.family as 4 | 6 }))
}

function validatedUrl(input: string): URL {
  let url: URL
  try { url = new URL(input) } catch { throw new PermanentJobError('Article URL is invalid') }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new PermanentJobError('Article URL must be credential-free HTTPS on the default port')
  return url
}

export async function extractArticle(input: string): Promise<string> {
  let url = validatedUrl(input)
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const addresses = await publicAddresses(url.hostname)
    let index = 0
    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname, options, callback) => {
          if (options.all) return callback(null, addresses)
          const selected = addresses[index++ % addresses.length]
          callback(null, selected.address, selected.family)
        },
      },
    })
    try {
      const response = await fetch(url, {
        dispatcher,
        redirect: 'manual',
        headers: { accept: 'text/html,application/xhtml+xml', 'user-agent': 'StranerdLibraryBot/1.0' },
        signal: AbortSignal.timeout(15_000),
      })
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        if (!location || redirects === MAX_REDIRECTS) throw new PermanentJobError('Article redirect limit exceeded')
        url = validatedUrl(new URL(location, url).toString())
        continue
      }
      if (!response.ok) {
        await response.body?.cancel()
        throw new Error(`Article request failed with HTTP ${response.status}`)
      }
      const contentType = response.headers.get('content-type')?.toLowerCase() || ''
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        await response.body?.cancel()
        throw new PermanentJobError('Article response is not HTML')
      }
      const declaredLength = Number(response.headers.get('content-length') || 0)
      if (declaredLength > LIMITS.maxArticleBytes) {
        await response.body?.cancel()
        throw new PermanentJobError('Article exceeds the size limit')
      }
      const bytes = await readBounded(response, LIMITS.maxArticleBytes)
      const html = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      const dom = new JSDOM(html, { url: url.toString() })
      const article = new Readability(dom.window.document).parse()
      const text = article?.textContent?.replace(/\s+/g, ' ').trim()
      if (!text) throw new PermanentJobError('No readable article content was found')
      return text.slice(0, LIMITS.maxSourceChars)
    } finally {
      await dispatcher.close()
    }
  }
  throw new PermanentJobError('Article redirect limit exceeded')
}

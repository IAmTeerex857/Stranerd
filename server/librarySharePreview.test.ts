import { readFileSync } from 'node:fs'
import type { Request, Response } from 'express'
import { describe, expect, it } from 'vitest'
import { isSocialCrawler, librarySharePreviewHandler, renderLibrarySharePreview, trustedLibraryShareOrigin } from './librarySharePreview.js'

describe('library share social preview', () => {
  it('detects major social crawlers without treating browsers as crawlers', () => {
    for (const userAgent of ['Twitterbot/1.0', 'facebookexternalhit/1.1', 'LinkedInBot/1.0', 'Slackbot-LinkExpanding 1.0', 'Discordbot/2.0', 'WhatsApp/2.0', 'TelegramBot', 'Pinterestbot/1.0']) {
      expect(isSocialCrawler(userAgent), userAgent).toBe(true)
    }
    expect(isSocialCrawler('Mozilla/5.0 Chrome/140.0 Safari/537.36')).toBe(false)
  })

  it('escapes metadata and emits only metadata-derived copy, canonical URLs, and noindex', () => {
    const html = renderLibrarySharePreview({ title: 'Heart <Deck> & "Notes"', outputType: 'practice', itemCount: 3 }, 'safe_token', 'https://example.com')
    expect(html).toContain('Heart &lt;Deck&gt; &amp; &quot;Notes&quot; | Stranerd')
    expect(html).toContain('A shared Stranerd study set with 3 practice questions.')
    expect(html).toContain('https://example.com/library/share?token=safe_token')
    expect(html).toContain('https://example.com/stranerd-social-card-v2.png')
    expect(html).toContain('noindex, nofollow, noarchive')
    expect(html).not.toContain('Heart <Deck>')
    expect(html).toContain('<body></body>')
  })

  it('uses only a secure configured origin', () => {
    expect(trustedLibraryShareOrigin('https://preview.example.com/a/path')).toBe('https://preview.example.com')
    expect(trustedLibraryShareOrigin('http://attacker.example.com')).toBe('https://learn.stranerd.com')
    expect(trustedLibraryShareOrigin('https://user:secret@example.com')).toBe('https://learn.stranerd.com')
    expect(trustedLibraryShareOrigin('not a URL')).toBe('https://learn.stranerd.com')
  })

  it('rejects direct browser requests with secure noindex headers', async () => {
    const headers = new Map<string, string>()
    const response = {
      setHeader: (name: string, value: string) => { headers.set(name, value) },
      status() { return this },
      type() { return this },
      send() { return this },
    } as unknown as Response
    const request = { headers: { 'user-agent': 'Mozilla/5.0' }, query: {} } as unknown as Request
    await librarySharePreviewHandler(request, response)
    expect(headers.get('Content-Security-Policy')).toContain("default-src 'none'")
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('X-Robots-Tag')).toContain('noindex')
  })

  it('routes crawler share requests before the SPA fallback on Vercel', () => {
    const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as { rewrites: Array<{ source: string; destination: string; has?: Array<{ value: string }> }> }
    const previewIndex = config.rewrites.findIndex((rewrite) => rewrite.destination === '/api/library?service=share-preview')
    const spaIndex = config.rewrites.findIndex((rewrite) => rewrite.destination === '/index.html')
    expect(previewIndex).toBeGreaterThanOrEqual(0)
    expect(previewIndex).toBeLessThan(spaIndex)
    expect(config.rewrites[previewIndex]).toMatchObject({ source: '/library/share' })
    const crawlerPattern = new RegExp(config.rewrites[previewIndex].has?.[0].value || '')
    expect(crawlerPattern.test('Twitterbot/1.0')).toBe(true)
    expect(crawlerPattern.test('Mozilla/5.0 Chrome/140.0')).toBe(false)
  })
})

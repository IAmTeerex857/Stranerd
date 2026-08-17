import type { Request, Response } from 'express'
import { getLibraryShareMetadata, libraryErrorResponse } from './library.js'

const PRODUCTION_ORIGIN = 'https://learn.stranerd.com'
const SOCIAL_CRAWLER_PATTERN = /(?:facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|pinterestbot|bluesky|skypeuripreview|iframely|embedly)/i

type ShareMetadata = {
  title: string
  outputType: 'flashcards' | 'practice'
  itemCount: number
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
}

export function isSocialCrawler(userAgent: string | undefined) {
  return SOCIAL_CRAWLER_PATTERN.test(userAgent || '')
}

export function trustedLibraryShareOrigin(configuredOrigin = process.env.APP_BASE_URL) {
  if (!configuredOrigin) return PRODUCTION_ORIGIN
  try {
    const parsed = new URL(configuredOrigin)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return PRODUCTION_ORIGIN
    return parsed.origin
  } catch {
    return PRODUCTION_ORIGIN
  }
}

export function renderLibrarySharePreview(metadata: ShareMetadata, token: string, origin = trustedLibraryShareOrigin()) {
  const title = `${metadata.title.trim() || 'Shared study set'} | Stranerd`
  const itemCount = Number.isSafeInteger(metadata.itemCount) && metadata.itemCount >= 0 ? metadata.itemCount : 0
  const itemName = metadata.outputType === 'flashcards'
    ? (itemCount === 1 ? 'flashcard' : 'flashcards')
    : (itemCount === 1 ? 'practice question' : 'practice questions')
  const description = `A shared Stranerd study set with ${itemCount} ${itemName}.`
  const canonicalUrl = `${origin}/library/share?token=${encodeURIComponent(token)}`
  const imageUrl = `${origin}/stranerd-social-card-v2.png`
  const escapedTitle = escapeHtml(title)
  const escapedDescription = escapeHtml(description)
  const escapedCanonicalUrl = escapeHtml(canonicalUrl)
  const escapedImageUrl = escapeHtml(imageUrl)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapedTitle}</title>
  <meta name="description" content="${escapedDescription}">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <link rel="canonical" href="${escapedCanonicalUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Stranerd">
  <meta property="og:title" content="${escapedTitle}">
  <meta property="og:description" content="${escapedDescription}">
  <meta property="og:url" content="${escapedCanonicalUrl}">
  <meta property="og:image" content="${escapedImageUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapedTitle}">
  <meta name="twitter:description" content="${escapedDescription}">
  <meta name="twitter:image" content="${escapedImageUrl}">
</head>
<body></body>
</html>`
}

function setPreviewHeaders(response: Response) {
  response.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300')
  response.setHeader('Content-Security-Policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'")
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive')
}

export async function librarySharePreviewHandler(request: Request, response: Response) {
  setPreviewHeaders(response)
  if (!isSocialCrawler(request.headers['user-agent'])) {
    response.setHeader('Content-Type', 'text/plain; charset=utf-8')
    return void response.status(404).send('Not found')
  }

  const token = typeof request.query.token === 'string' ? request.query.token : ''
  try {
    const metadata = await getLibraryShareMetadata(token) as ShareMetadata
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.send(renderLibrarySharePreview(metadata, token))
  } catch (error) {
    const result = libraryErrorResponse(error)
    response.setHeader('Content-Type', 'text/plain; charset=utf-8')
    response.status(result.status).send('Share preview unavailable')
  }
}

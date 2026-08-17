import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MaterialMarkdown } from './MaterialMarkdown'

describe('MaterialMarkdown images', () => {
  it('renders valid figures with the first image eager and later images lazy', () => {
    const html = renderToStaticMarkup(<MaterialMarkdown markdown={'![First](/first.png)\n\n![Second](/second.png)'} mnemonics={new Map()} imageMetadata={new Map([['/first.png', { width: 1200, height: 600, srcSet: '/first-480.webp 480w, /first.png 1200w' }]])} />)

    expect(html).not.toContain('<p><figure')
    expect(html).toMatch(/<figure[^>]*>.*<img[^>]*src="\/first\.png"[^>]*loading="eager"/)
    expect(html).toMatch(/<figure[^>]*>.*<img[^>]*src="\/second\.png"[^>]*loading="lazy"/)
    expect(html).toContain('width="1200"')
    expect(html).toContain('height="600"')
    expect(html).toContain('srcSet="/first-480.webp 480w, /first.png 1200w"')
    expect(html).toContain('sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1100px) calc(100vw - 96px), 760px"')
    expect(html).not.toMatch(/src="\/second\.png"[^>]*(?:width|srcSet|sizes)=/)
  })
})

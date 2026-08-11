import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildMaterialsManifest, rewriteMarkdownAssetUrls } from './materialsImport.js'

const temporary: string[] = []
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])
const jpeg = Buffer.from([255, 216, 255, 224, 0])

async function fixture(overrides: { notes?: string; figures?: unknown; flashcards?: unknown; questions?: unknown; assets?: Record<string, Buffer>; sections?: string } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'materials-import-'))
  temporary.push(root)
  const subject = 'test-subject'
  const directory = path.join(root, subject)
  await mkdir(path.join(directory, 'assets'), { recursive: true })
  const notes = overrides.notes ?? '# Test\n<!-- source-page: 1 -->\n![PNG](./assets/one.png)\n![JPEG](./assets/two.jpeg)\n'
  const figures = overrides.figures ?? [
    { alt: 'PNG', attribution: null, dedup: false, file: './assets/one.png', h1: 'Test', h2: null, height: 1, md5: 'a', native_dpi: 72, page: 1, width: 1 },
    { alt: 'JPEG', attribution: null, dedup: false, file: './assets/two.jpeg', h1: 'Test', h2: null, height: 1, md5: 'b', native_dpi: 72, page: 1, width: 1 },
  ]
  const question = {
    id: 'mcq-test-001', question: 'What is shown?', options: { A: 'One', B: 'Two', C: 'Three', D: 'Four' }, answer: 'A', explanation: 'One.', subject,
    chapter: 'Test', section: 'Test', source_page: 1, evidence_quote: 'Evidence', confidence: 'high', needs_review: true, generated: true,
    content_hash: 'a'.repeat(64), review: { status: 'pending' },
  }
  await Promise.all([
    writeFile(path.join(directory, 'notes.md'), notes),
    writeFile(path.join(directory, 'figures.json'), `${JSON.stringify(figures)}\n`),
    writeFile(path.join(directory, 'mnemonics.json'), `${JSON.stringify([{ id: 'mn-one', body: 'Body', title: 'Title', section: 'Test', source_page: 1, subject }])}\n`),
    writeFile(path.join(directory, 'flashcards.json'), `${JSON.stringify(overrides.flashcards ?? [{ id: 'card-one', type: 'basic', front: 'What is Aorta?', back: 'The main artery carrying blood away from the heart.', section: 'Test', source_page: 1, subject, tags: ['definition'] }])}\n`),
    writeFile(path.join(directory, 'tests.generated.json'), `${JSON.stringify(overrides.questions ?? [question])}\n`),
    writeFile(path.join(directory, 'sections.jsonl'), overrides.sections ?? `${JSON.stringify({ id: 'sec-one', content: '# Test\nEvidence', heading_path: ['Test'], source_page_start: 1, source_page_end: 1, subject, title: 'Test' })}\n`),
  ])
  const assets = overrides.assets ?? { 'one.png': png, 'two.jpeg': jpeg }
  await Promise.all(Object.entries(assets).map(([name, bytes]) => writeFile(path.join(directory, 'assets', name), bytes)))
  return root
}

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('Markdown asset rewriting', () => {
  it('rewrites only local Markdown image destinations and preserves every other byte', () => {
    const markdown = ':::mnemonic{#one}\n![local](./assets/one.png "title")\n[link](./assets/one.png) ![remote](https://x.test/a.png)\\\n\\![escaped](./assets/one.png) `![code](./assets/one.png)`\n```md\n![fenced](./assets/one.png)\n```\n:::\n'
    expect(rewriteMarkdownAssetUrls(markdown, new Map([['./assets/one.png', 'https://cdn.test/one.png']]))).toBe(
      ':::mnemonic{#one}\n![local](https://cdn.test/one.png "title")\n[link](./assets/one.png) ![remote](https://x.test/a.png)\\\n\\![escaped](./assets/one.png) `![code](./assets/one.png)`\n```md\n![fenced](./assets/one.png)\n```\n:::\n',
    )
  })

  it('rejects path traversal', () => {
    expect(() => rewriteMarkdownAssetUrls('![bad](./assets/../secret.png)', new Map())).toThrow(/traversal|nested path/)
  })
})

describe('materials manifest', () => {
  it('recognizes PNG/JPEG, is deterministic, and retains original paths', async () => {
    const root = await fixture()
    const first = await buildMaterialsManifest({ outputRoot: root, publicBaseUrl: 'https://cdn.test/materials' })
    const second = await buildMaterialsManifest({ outputRoot: root, publicBaseUrl: 'https://cdn.test/materials' })
    expect(second).toEqual(first)
    expect(first.subjects[0].assets.map((asset) => asset.mimeType)).toEqual(['image/png', 'image/jpeg'])
    expect(first.subjects[0].assets.map((asset) => asset.originalPath)).toEqual(['./assets/one.png', './assets/two.jpeg'])
    expect(first.subjects[0].release.notesMarkdown).toContain(`/assets/${first.subjects[0].assets[0].sha256}/one.png`)
    expect(first.subjects[0].release.sourceMetadata.editorial_version).toBe('materials-2026-08-11-v2')
    expect(first.subjects[0].release.sourceMetadata.questions_editorial_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(first.subjects[0].flashcards[0]).toMatchObject({ id: 'card-one', type: 'basic', front: 'Which term matches this description? The main artery carrying blood away from the heart.', back: 'Aorta', source_page: 1 })
  })

  it('keeps pending questions hidden unless all questions are explicitly approved', async () => {
    const root = await fixture({ questions: [{
      id: 'mcq-test-001', question: 'Which answer is listed in the source?', options: { A: '**One**', B: 'Two', C: 'Three', D: 'Four' }, answer: 'A', explanation: 'The defining answer in the source is one.', subject: 'test-subject',
      chapter: 'Test', section: 'Test', source_page: 1, evidence_quote: 'Evidence', confidence: 'high', needs_review: true, generated: true,
      content_hash: 'a'.repeat(64), review: { status: 'pending' },
    }] })
    const pending = await buildMaterialsManifest({ outputRoot: root })
    const approved = await buildMaterialsManifest({ outputRoot: root, approveQuestions: true })
    expect(pending.subjects[0].questions[0]).toMatchObject({ status: 'pending', published: false })
    expect(approved.subjects[0].questions[0]).toMatchObject({ status: 'approved', published: true })
    expect(approved.subjects[0].questions[0]).toMatchObject({ question: 'Which answer is?', options: { A: 'One' }, explanation: 'The defining answer is one.' })
    expect(approved.subjects[0].release.id).not.toBe(pending.subjects[0].release.id)
    expect(approved.subjects[0].assets[0].storagePath).toBe(pending.subjects[0].assets[0].storagePath)
  })

  it('deduplicates identical figure placements while retaining unique assets', async () => {
    const placement = { alt: 'PNG', attribution: null, dedup: true, file: './assets/one.png', h1: 'Test', h2: null, height: 1, md5: 'a', native_dpi: 72, page: 1, width: 1 }
    const root = await fixture({ notes: '# Test\n<!-- source-page: 1 -->\n![PNG](./assets/one.png)\n', figures: [placement, placement], assets: { 'one.png': png } })
    const manifest = await buildMaterialsManifest({ outputRoot: root })
    expect(manifest.subjects[0].figures).toHaveLength(1)
    expect(manifest.subjects[0].assets).toHaveLength(1)
  })

  it('rejects malformed schemas', async () => {
    const root = await fixture({ sections: '{not json}\n' })
    await expect(buildMaterialsManifest({ outputRoot: root })).rejects.toThrow(/malformed/)
  })

  it('rejects missing and stale assets', async () => {
    const missing = await fixture({ assets: { 'one.png': png } })
    await expect(buildMaterialsManifest({ outputRoot: missing })).rejects.toThrow(/stale or missing/)
    const stale = await fixture({ assets: { 'one.png': png, 'two.jpeg': jpeg, 'stale.png': png } })
    await expect(buildMaterialsManifest({ outputRoot: stale })).rejects.toThrow(/stale or missing/)
  })
})

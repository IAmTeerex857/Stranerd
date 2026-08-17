import { describe, expect, it, vi } from 'vitest'
import { collectPaginated, isHeadingOnlyMaterialSection, mapMaterialAssetMetadata, mapMaterialFlashcard, mapMaterialQuestion, mapMaterialSubject, materialFlashcardFace, materialTitle, parseMaterialMarkdown, safeMaterialUrl } from './materials'
import { findMaterialCatalogDeck, materialCatalogDecks } from './materialCatalog'

describe('materials mapping', () => {
  it('maps catalog counts and release identifiers', () => {
    expect(mapMaterialSubject({ id: 's', slug: 'biology', title: 'Biology', release_id: 'r', content_hash: 'v2', section_count: 12, mnemonic_count: 3, flashcard_count: 40, question_count: 8 })).toMatchObject({ slug: 'biology', releaseId: 'r', contentVersion: 'v2', counts: { sections: 12, mnemonics: 3, flashcards: 40, questions: 8 } })
  })

  it('creates canonical material deck IDs without changing catalog order', () => {
    const subject = (title: string, releaseId: string) => mapMaterialSubject({ id: releaseId, slug: title.toLowerCase().replaceAll(' ', '-'), title, release_id: releaseId })
    const decks = materialCatalogDecks([subject('Heart', 'heart-v2'), subject('Endocrine System', 'endocrine-v1')])
    expect(decks).toEqual([
      { id: 'materials:heart-v2', releaseId: 'heart-v2', title: 'Heart' },
      { id: 'materials:endocrine-v1', releaseId: 'endocrine-v1', title: 'Endocrine System' },
    ])
    expect(findMaterialCatalogDeck(decks, 'materials:endocrine-v1')?.releaseId).toBe('endocrine-v1')
    expect(findMaterialCatalogDeck(decks, 'heart-core')).toBeUndefined()
  })

  it('only maps approved published A-D questions in deterministic order', () => {
    const base = { stable_id: 'q1', ordinal: 1, question: '17. Question?', options: { D: 'four', B: 'two', A: 'one', C: 'three' }, answer: 'C', explanation: 'Because.', chapter: 'One', section: 'Basics' }
    expect(mapMaterialQuestion({ ...base, published: true, review_status: 'approved' })).toMatchObject({ question: 'Question?', options: ['one', 'two', 'three', 'four'], answerIndex: 2 })
    expect(mapMaterialQuestion({ ...base, published: false, review_status: 'approved' })).toBeNull()
  })

  it('removes imported numbering from section titles', () => {
    expect(materialTitle('  3. Heart Wall Layers: ')).toBe('Heart Wall Layers:')
    expect(materialTitle('Chambers of the Heart')).toBe('Chambers of the Heart')
  })

  it('maps responsive asset metadata and ignores legacy empty metadata', () => {
    expect(mapMaterialAssetMetadata({ url: 'https://signed.test/original', width: 1200, height: 600, srcSet: 'https://signed.test/480 480w, https://signed.test/768 768w, https://signed.test/original 1200w' })).toEqual([
      'https://signed.test/original',
      { width: 1200, height: 600, srcSet: 'https://signed.test/480 480w, https://signed.test/768 768w, https://signed.test/original 1200w' },
    ])
    expect(mapMaterialAssetMetadata({ url: 'https://signed.test/legacy' })).toBeNull()
  })
})

describe('materials pagination', () => {
  it('continues through full pages and stops on the short page', async () => {
    const pages = [[1, 2], [3, 4], [5]]
    const fetchPage = vi.fn(async () => pages.shift() ?? [])
    await expect(collectPaginated(fetchPage, 2)).resolves.toEqual([1, 2, 3, 4, 5])
    expect(fetchPage.mock.calls).toEqual([[0, 1], [2, 3], [4, 5]])
  })
})

describe('material Markdown', () => {
  it('separates mnemonic blocks without altering surrounding Markdown', () => {
    expect(parseMaterialMarkdown('# Heading\n\n:::mnemonic{#cranial-nerves}\n**Useful Mnemonics**\nA duplicated source body.\n:::\n\nNext')).toEqual([
      { kind: 'markdown', content: '# Heading\n\n' },
      { kind: 'mnemonic', id: 'cranial-nerves' },
      { kind: 'markdown', content: '\nNext' },
    ])
  })

  it('allows web and local URLs but rejects executable schemes', () => {
    expect(safeMaterialUrl('https://cdn.example/image.png')).toBe('https://cdn.example/image.png')
    expect(safeMaterialUrl('/materials/image.png')).toBe('/materials/image.png')
    expect(safeMaterialUrl('//attacker.example/image.png')).toBeUndefined()
    expect(safeMaterialUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeMaterialUrl('data:text/html,bad')).toBeUndefined()
  })

  it('identifies only explicit Markdown heading divider content', () => {
    expect(isHeadingOnlyMaterialSection('<!-- imported page -->\n# Cardiovascular System\n\n## Overview')).toBe(true)
    expect(isHeadingOnlyMaterialSection('Cardiovascular System\n===')).toBe(true)
    expect(isHeadingOnlyMaterialSection('<!-- comment only -->')).toBe(false)
    expect(isHeadingOnlyMaterialSection('<h1>Cardiovascular System</h1>')).toBe(false)
    expect(isHeadingOnlyMaterialSection('# Cardiovascular System\nIntroductory body text.')).toBe(false)
    expect(isHeadingOnlyMaterialSection('    # Code, not a heading')).toBe(false)
    expect(isHeadingOnlyMaterialSection('![missing diagram](/missing.png)')).toBe(false)
    expect(isHeadingOnlyMaterialSection('# ![missing diagram](/missing.png)')).toBe(false)
  })
})

describe('material flashcards', () => {
  it('normalizes legacy cloze and Markdown without placeholders', () => {
    const card = { type: 'cloze' as const, front: '{{c1::Aorta}} carries {{c2::blood::fluid}}.', back: 'Aorta carries blood.' }
    expect(materialFlashcardFace(card, false)).toBe('Aorta carries blood.')
    expect(materialFlashcardFace(card, true)).toBe('Aorta carries blood.')
    expect(mapMaterialFlashcard({ stable_id: 'c1', ordinal: 2, card_type: 'cloze', front: '{{c1::Aorta}}: ## The main artery carrying blood away from the heart.', back: 'Aorta', section: 'Heart', tags: ['definition'] })).toMatchObject({
      id: 'c1', type: 'basic', front: 'Which term matches this description? The main artery carrying blood away from the heart.', back: 'Aorta',
    })
  })
})

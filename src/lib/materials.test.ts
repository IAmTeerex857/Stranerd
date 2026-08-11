import { describe, expect, it, vi } from 'vitest'
import { collectPaginated, mapMaterialFlashcard, mapMaterialQuestion, mapMaterialSubject, materialFlashcardFace, parseMaterialMarkdown, safeMaterialUrl } from './materials'

describe('materials mapping', () => {
  it('maps catalog counts and release identifiers', () => {
    expect(mapMaterialSubject({ id: 's', slug: 'biology', title: 'Biology', release_id: 'r', content_hash: 'v2', section_count: 12, mnemonic_count: 3, flashcard_count: 40, question_count: 8 })).toMatchObject({ slug: 'biology', releaseId: 'r', contentVersion: 'v2', counts: { sections: 12, mnemonics: 3, flashcards: 40, questions: 8 } })
  })

  it('only maps approved published A-D questions in deterministic order', () => {
    const base = { stable_id: 'q1', ordinal: 1, question: 'Question?', options: { D: 'four', B: 'two', A: 'one', C: 'three' }, answer: 'C', explanation: 'Because.', chapter: 'One', section: 'Basics' }
    expect(mapMaterialQuestion({ ...base, published: true, review_status: 'approved' })).toMatchObject({ options: ['one', 'two', 'three', 'four'], answerIndex: 2 })
    expect(mapMaterialQuestion({ ...base, published: false, review_status: 'approved' })).toBeNull()
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

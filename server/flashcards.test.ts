import { describe, expect, it } from 'vitest'
import { parseGeneratedDeck, validateGenerationRequest } from './flashcards.js'

const validCards = Array.from({ length: 15 }, (_, index) => ({ kind: 'fact-recall', front: { heading: `Question ${index}?`, body: `Recall concept ${index}`, diagram: null }, back: { heading: `Answer ${index}`, body: `Verified answer ${index}` } }))

describe('generated flashcards', () => {
  it('validates fixed generation settings', () => {
    expect(validateGenerationRequest({ modelId: 'heart', difficulty: 'intermediate', focus: 'mixed', visibility: 'private', includeDiagrams: true })).toBeDefined()
    expect(validateGenerationRequest({ modelId: 'missing', difficulty: 'intermediate', focus: 'mixed', visibility: 'private' })).toBeUndefined()
  })

  it('accepts exactly 15 complete unique cards', () => {
    const deck = parseGeneratedDeck(JSON.stringify({ title: 'Heart review', description: 'A focused review.', cards: validCards }), 'heart', true, '123e4567-e89b-42d3-a456-426614174000')
    expect(deck?.cards).toHaveLength(15)
    expect(deck?.cards[0].id).toContain('123e4567')
  })

  it('falls back to text when a diagram ID is invalid', () => {
    const cards = validCards.map((card, index) => index === 0 ? { ...card, front: { ...card.front, diagram: { variantId: 'primary', selectedStructureIds: ['missing'] } } } : card)
    const deck = parseGeneratedDeck(JSON.stringify({ title: 'Heart review', description: 'A focused review.', cards }), 'heart', true)
    expect(deck?.cards[0].front.diagram).toBeUndefined()
  })

  it('rejects wrong card counts and duplicate cards', () => {
    expect(parseGeneratedDeck(JSON.stringify({ title: 'Short', description: 'No.', cards: validCards.slice(0, 14) }), 'heart', false)).toBeUndefined()
    expect(parseGeneratedDeck(JSON.stringify({ title: 'Duplicate', description: 'No.', cards: Array(15).fill(validCards[0]) }), 'heart', false)).toBeUndefined()
  })

  it('rejects generic highlighted-structure prompts', () => {
    const cards = validCards.map((card, index) => index === 0 ? { ...card, front: { ...card.front, heading: 'Identify the highlighted structure' } } : card)
    expect(parseGeneratedDeck(JSON.stringify({ title: 'Weak deck', description: 'Generic prompts.', cards }), 'heart', false)).toBeUndefined()
  })
})

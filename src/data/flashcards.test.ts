import { describe, expect, it } from 'vitest'
import { models } from './models'
import { defaultFlashcardDecks, resolveFlashcardDiagram } from './flashcards'

describe('default flashcard decks', () => {
  it('ships a verified free deck for every model', () => {
    expect(defaultFlashcardDecks).toHaveLength(models.length)
    expect(new Set(defaultFlashcardDecks.map((deck) => deck.modelId))).toEqual(new Set(models.map((model) => model.id)))
    expect(new Set(defaultFlashcardDecks.map((deck) => deck.id)).size).toBe(defaultFlashcardDecks.length)
    for (const deck of defaultFlashcardDecks) {
      expect(deck.cards).toHaveLength(15)
      expect(new Set(deck.cards.map((card) => card.id)).size).toBe(deck.cards.length)
      for (const card of deck.cards) {
        expect(card.front.heading).toMatch(/\?$/)
        expect(card.front.heading.toLowerCase()).not.toBe('identify the structure')
        expect(card.front.body.toLowerCase()).not.toContain('highlighted')
        expect(card.front.body.trim()).not.toBe('')
        expect(card.back.body.trim()).not.toBe('')
        expect(card.front.diagram).toBeDefined()
        expect(resolveFlashcardDiagram(card.front.diagram!)).toBeDefined()
      }
    }
  })

  it('rejects stale diagram references instead of substituting another model', () => {
    expect(resolveFlashcardDiagram({ modelId: 'missing', variantId: 'v1', selectedStructureIds: ['heart'] })).toBeUndefined()
    expect(resolveFlashcardDiagram({ modelId: 'heart', variantId: 'missing', selectedStructureIds: ['aorta'] })).toBeUndefined()
    expect(resolveFlashcardDiagram({ modelId: 'heart', variantId: 'primary', selectedStructureIds: ['missing'] })).toBeUndefined()
  })
})

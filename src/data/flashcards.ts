import { models } from './models'
import type { FlashcardDeck, FlashcardDiagram } from '../types'

export const defaultFlashcardDecks: FlashcardDeck[] = models.map((model) => {
  const variant = model.variants.find((entry) => entry.hotspots?.length) ?? model.variants[0]
  const structures = (variant.hotspots ?? model.hotspots).slice(0, 3)
  const diagram = (structureId: string): FlashcardDiagram => ({ modelId: model.id, variantId: variant.id, selectedStructureIds: [structureId] })
  const structureCards = structures.flatMap((structure) => [
    {
      id: `${model.id}-identify-${structure.id}`,
      kind: 'identify-structure' as const,
      front: { heading: 'Identify the structure', body: 'Which anatomical structure is highlighted?', diagram: diagram(structure.id) },
      back: { heading: structure.label, body: `${structure.detail} Region: ${model.metadata.region}.` },
    },
    {
      id: `${model.id}-function-${structure.id}`,
      kind: 'structure-to-function' as const,
      front: { heading: structure.label, body: 'Recall the location or function of this structure.', diagram: diagram(structure.id) },
      back: { heading: 'Structure in context', body: structure.detail },
    },
  ])
  const factCards = model.facts.slice(0, Math.max(2, 6 - structureCards.length)).map((fact, index) => ({
    id: `${model.id}-fact-${index + 1}`,
    kind: 'fact-recall' as const,
    front: { heading: `${model.name} recall`, body: `Explain this ${model.metadata.focus.toLowerCase()} concept before revealing the answer.` },
    back: { heading: `Key fact ${index + 1}`, body: fact },
  }))
  return {
    id: `${model.id}-foundations`,
    modelId: model.id,
    contentVersion: '1',
    title: `${model.name} foundations`,
    description: `Verified structure, function, and context cards for ${model.name.toLowerCase()}.`,
    cards: [...structureCards, ...factCards],
  }
})

export const flashcardDeckById = (deckId: string) => defaultFlashcardDecks.find((deck) => deck.id === deckId)
export const flashcardDeckForModel = (modelId: string) => defaultFlashcardDecks.find((deck) => deck.modelId === modelId)

export function resolveFlashcardDiagram(diagram: FlashcardDiagram) {
  const model = models.find((entry) => entry.id === diagram.modelId)
  const variant = model?.variants.find((entry) => entry.id === diagram.variantId)
  if (!model || !variant || diagram.selectedStructureIds.length === 0) return undefined
  const hotspots = variant.hotspots ?? model.hotspots
  const selected = diagram.selectedStructureIds.map((id) => hotspots.find((hotspot) => hotspot.id === id))
  if (selected.some((hotspot) => !hotspot)) return undefined
  return { model, variant, hotspots, selected: selected.filter((hotspot) => hotspot !== undefined) }
}

export function flashcardProgress(deck: FlashcardDeck, cards: Record<string, unknown> | undefined) {
  const reviewed = deck.cards.filter((card) => Boolean(cards?.[card.id])).length
  return { reviewed, total: deck.cards.length, status: reviewed === 0 ? 'not-started' as const : reviewed === deck.cards.length ? 'complete' as const : 'in-progress' as const }
}

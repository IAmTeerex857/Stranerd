import { models } from './models.js'
import type { FlashcardDeck, FlashcardDeckProgress, FlashcardDiagram } from '../types.js'

export const defaultFlashcardDecks: FlashcardDeck[] = models.map((model) => {
  const variant = model.variants.find((entry) => entry.hotspots?.length) ?? model.variants.find((entry) => entry.segmentedSystem) ?? model.variants[0]
  const structures = variant.hotspots?.length ? variant.hotspots : model.hotspots
  const selected = Array.from({ length: 5 }, (_, index) => structures[index % structures.length])
  const describe = (value: string) => value.replace(/\.$/, '').replace(/^./, (letter) => letter.toLowerCase())
  const diagram = (structureId: string): FlashcardDiagram => ({ modelId: model.id, variantId: variant.id, selectedStructureIds: [structureId] })
  const cards = selected.flatMap((structure, index) => [
    {
      id: `${model.id}-${structure.id}-description-${index}`,
      kind: 'identify-structure' as const,
      front: { heading: `Which structure is described as ${describe(structure.detail)}?`, body: `Consider its location and relationship to nearby anatomy.`, diagram: diagram(structure.id) },
      back: { heading: structure.label, body: structure.detail },
    },
    {
      id: `${model.id}-${structure.id}-function-${index}`,
      kind: 'structure-to-function' as const,
      front: { heading: `What is the principal anatomical role of the ${structure.label}?`, body: `Relate its structure to its function or pathway.`, diagram: diagram(structure.id) },
      back: { heading: structure.label, body: structure.detail },
    },
    {
      id: `${model.id}-${structure.id}-relationship-${index}`,
      kind: 'fact-recall' as const,
      front: { heading: `Why is the ${structure.label} important when studying ${model.metadata.focus.toLowerCase()}?`, body: `State the key anatomical relationship shown in the model.`, diagram: diagram(structure.id) },
      back: { heading: structure.label, body: structure.detail },
    },
  ])
  return {
    id: `${model.id}-foundations`,
    modelId: model.id,
    contentVersion: '3',
    title: model.name,
    description: '',
    cards,
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

export function flashcardProgress(deck: FlashcardDeck, progress: FlashcardDeckProgress | undefined) {
  const cards = progress?.contentVersion === deck.contentVersion ? progress.cards : undefined
  const reviewed = deck.cards.filter((card) => cards?.[card.id]?.grade !== undefined && cards[card.id].grade !== 'again').length
  return { reviewed, total: deck.cards.length, status: reviewed === 0 ? 'not-started' as const : reviewed === deck.cards.length ? 'complete' as const : 'in-progress' as const }
}

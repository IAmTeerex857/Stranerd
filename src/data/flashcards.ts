import { models } from './models'
import { lessonsForModel } from './lessons'
import { quizForModel } from './quizzes'
import type { FlashcardDeck, FlashcardDiagram } from '../types'

export const defaultFlashcardDecks: FlashcardDeck[] = models.map((model) => {
  const quiz = quizForModel(model.id)
  const quizCard = quiz && {
    id: `${model.id}-exam-core`,
    kind: 'fact-recall' as const,
    front: { heading: quiz.question, body: 'Answer before revealing the explanation.' },
    back: { heading: quiz.options[quiz.correctIndex], body: quiz.explanation },
  }
  const lessonCards = lessonsForModel(model.id).map((lesson) => ({
    id: `${model.id}-exam-${lesson.id}`,
    kind: 'structure-to-function' as const,
    front: { heading: lesson.prompt, body: 'Give the structure and explain the anatomical reasoning.' },
    back: { heading: lesson.title, body: lesson.fallback },
  }))
  return {
    id: `${model.id}-foundations`,
    modelId: model.id,
    contentVersion: '2',
    title: `${model.name} foundations`,
    description: `Authored anatomy questions covering structure, function, and clinical relationships in ${model.name.toLowerCase()}.`,
    cards: [...(quizCard ? [quizCard] : []), ...lessonCards],
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

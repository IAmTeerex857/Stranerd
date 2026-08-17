import { models } from './models'

export const builtInFlashcardCatalog = models.map((model) => ({
  id: `${model.id}-foundations`,
  modelId: model.id,
  contentVersion: '3',
  title: model.name,
  description: '',
  cardCount: 15,
}))

export const builtInFlashcardMetadata = (deckId: string) => builtInFlashcardCatalog.find((deck) => deck.id === deckId)

import type { MaterialCatalogDeck, MaterialSubject } from '../types/materials'

export function materialCatalogDecks(subjects: MaterialSubject[]): MaterialCatalogDeck[] {
  return subjects.map((subject) => ({ id: `materials:${subject.releaseId}`, releaseId: subject.releaseId, title: subject.title }))
}

export function findMaterialCatalogDeck(decks: MaterialCatalogDeck[], deckId: string) {
  return decks.find((deck) => deck.id === deckId)
}

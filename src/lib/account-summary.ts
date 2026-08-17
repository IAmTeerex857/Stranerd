import type { PersistedState } from '../types'
import { builtInFlashcardCatalog } from '../data/flashcardCatalog'

export function deriveLocalLearningSummary(state: PersistedState) {
  const flashcards = builtInFlashcardCatalog.map((deck) => {
    const progress = state.flashcardProgressByDeck[deck.id]
    const reviewed = progress?.contentVersion === deck.contentVersion ? Object.values(progress.cards).filter((card) => card.grade && card.grade !== 'again').length : 0
    return { deck, reviewed, total: deck.cardCount, status: reviewed === 0 ? 'not-started' as const : reviewed >= deck.cardCount ? 'complete' as const : 'in-progress' as const }
  })
  return {
    flashcards,
    reviewedFlashcards: flashcards.reduce((total, progress) => total + progress.reviewed, 0),
    totalFlashcards: flashcards.reduce((total, progress) => total + progress.total, 0),
  }
}

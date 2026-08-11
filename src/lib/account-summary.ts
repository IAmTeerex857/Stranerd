import type { PersistedState } from '../types'
import { defaultFlashcardDecks, flashcardProgress } from '../data/flashcards'

export function deriveLocalLearningSummary(state: PersistedState) {
  const flashcards = defaultFlashcardDecks.map((deck) => ({ deck, ...flashcardProgress(deck, state.flashcardProgressByDeck[deck.id]) }))
  return {
    flashcards,
    reviewedFlashcards: flashcards.reduce((total, progress) => total + progress.reviewed, 0),
    totalFlashcards: flashcards.reduce((total, progress) => total + progress.total, 0),
  }
}

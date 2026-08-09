import { models } from '../data/models'
import { assessmentProgressForModel } from '../data/quizzes'
import type { PersistedState } from '../types'
import { defaultFlashcardDecks, flashcardProgress } from '../data/flashcards'

export function deriveLocalLearningSummary(state: PersistedState) {
  const assessmentProgress = models.map((model) => ({ model, ...assessmentProgressForModel(model.id, state.completedQuizIds) }))
  const favorites = models.filter((model) => state.favoriteModelIds.includes(model.id))
  const savedStructures = state.bookmarkedHotspotRefs.flatMap((reference) => {
    const separator = reference.indexOf(':')
    if (separator < 1) return []
    const model = models.find((entry) => entry.id === reference.slice(0, separator))
    const hotspot = model?.hotspots.find((entry) => entry.id === reference.slice(separator + 1))
    return model && hotspot ? [{ reference, model, hotspot }] : []
  })
  const flashcards = defaultFlashcardDecks.map((deck) => ({ deck, ...flashcardProgress(deck, state.flashcardProgressByDeck[deck.id]?.cards) }))
  return {
    assessmentProgress,
    completedQuestions: assessmentProgress.reduce((total, progress) => total + progress.completed, 0),
    totalQuestions: assessmentProgress.reduce((total, progress) => total + progress.total, 0),
    favorites,
    savedStructures,
    flashcards,
    reviewedFlashcards: flashcards.reduce((total, progress) => total + progress.reviewed, 0),
    totalFlashcards: flashcards.reduce((total, progress) => total + progress.total, 0),
  }
}

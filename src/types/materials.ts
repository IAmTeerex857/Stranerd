import type { FlashcardGrade } from '../types'
import type { VoiceAction, VoiceActionResult } from '../lib/voiceActions'

export type MaterialSubject = {
  id: string
  slug: string
  title: string
  releaseId: string
  contentVersion: string
  publishedAt: string | null
  counts: { sections: number; mnemonics: number; flashcards: number; questions: number }
}

export type MaterialSectionSummary = {
  id: string
  ordinal: number
  title: string
  headingPath: string[]
  pageStart: number
  pageEnd: number
}

export type MaterialSection = MaterialSectionSummary & { content: string }

export type MaterialImageMetadata = {
  width: number
  height: number
  srcSet: string
}

export type MaterialQuestionGrade = { id: string; answerIndex: number; explanation: string }

export type LibraryContentMode = 'notes' | 'practice' | 'flashcards'

export type ActiveNoteContext = {
  subject: string
  subjectSlug: string
  releaseId: string
  sectionId: string
  section: string
  pageStart: number
  pageEnd: number
  selectedText: string
}

export type NoteSelectionRequest = {
  id: string
  prompt: string
}

export type MaterialMnemonic = { id: string; title: string; body: string; section: string | null; sourcePage: number }

export type MaterialFlashcard = {
  id: string
  ordinal: number
  type: 'basic' | 'cloze'
  front: string
  back: string
  section: string | null
  tags: string[]
}

export type MaterialQuestion = {
  id: string
  ordinal: number
  question: string
  options: [string, string, string, string]
  answerIndex: number
  explanation: string
  chapter: string
  section: string
}

export type MaterialReview = { grade: FlashcardGrade; reviewCount: number; updatedAt: string }

export type MaterialAssessmentVoiceState = {
  target: 'material-practice'
  subject: string
  questionId: string
  index: number
  count: number
  question: string
  options: string[]
  selectedIndex: number | null
  submitted: boolean
  hint?: string
  phase: 'taking' | 'result' | 'review'
  score?: number
  correctAnswer?: string
  explanation?: string
}

export type MaterialFlashcardVoiceState = {
  target: 'material-flashcards'
  subject: string
  deckId: string
  cardId: string
  index: number
  count: number
  side: 'question' | 'answer'
  graded: boolean
  question: { heading: string; body: string }
  answer?: { heading: string; body: string }
  hint?: string
}

export type MaterialLearningState = MaterialAssessmentVoiceState | MaterialFlashcardVoiceState

export type MaterialLearningController = {
  target: MaterialLearningState['target']
  executeVoiceAction: (action: Extract<VoiceAction, { type: `assessment.${string}` | `flashcard.${string}` | `materialFlashcard.${string}` }>) => VoiceActionResult | Promise<VoiceActionResult>
}

export type MaterialCatalogDeck = {
  id: `materials:${string}`
  releaseId: string
  title: string
}

export type MaterialCatalogState = {
  decks: MaterialCatalogDeck[]
  activeReleaseId?: string
}

export type MaterialCatalogController = {
  openRelease: (releaseId: string) => Promise<boolean>
}

export type MaterialCatalogRegistration = {
  state: MaterialCatalogState
  controller: MaterialCatalogController
}

export type MaterialMarkdownPart =
  | { kind: 'markdown'; content: string }
  | { kind: 'mnemonic'; id: string }

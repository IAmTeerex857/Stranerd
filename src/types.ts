export type ViewId = 'explore' | 'library' | 'studio' | 'lab'

export type Hotspot = {
  id: string
  label: string
  detail: string
  position: [number, number, number]
  nodeId?: string
  systemId?: AnatomySystemId
  source?: 'marker' | 'mesh'
  conditions?: ConditionRecord[]
}

export type AnatomySystemId = 'skin' | 'muscular' | 'skeleton' | 'cardiovascular' | 'nervous' | 'organs'

export type ConditionRecord = {
  id: string
  label: string
  summary: string
  structureTerms: string[]
}

export type AnatomyLayer = {
  id: AnatomySystemId
  label: string
  file: string
  color: string
  namedNodeCount: number
  directMeshCount: number
  defaultVisible: boolean
}

/**
 * Canonical framing for one subject, authored against the 3.15-unit normalization at fov 42.
 * Orbit is stored as azimuth/elevation rather than a world position so the entry survives
 * any re-centering, and the clamp replaces the former global 2.2-8 for this subject.
 */
export type CanonicalCamera = {
  azimuth: number
  elevation: number
  distance: number
  minDistance: number
  maxDistance: number
  view: string
}

export type ModelEntry = {
  id: string
  name: string
  scientificName: string
  system: string
  file: string
  variants: { id: string; label: string; file: string; note?: string; segmentedSystem?: AnatomySystemId; hotspots?: Hotspot[] }[]
  description: string
  facts: string[]
  metadata: { region: string; scale: string; focus: string }
  hotspots: Hotspot[]
  anatomy: boolean
  viewer?: 'standard' | 'segmented-body'
  camera: CanonicalCamera
}

export type LessonState = { selectedIds: string[] }
export type Evaluation = { pass: boolean; detail: string }

export type Lesson = {
  id: string
  title: string
  prompt: string
  targetIds: string[]
  hints: string[]
  fallback: string
  evaluate: (state: LessonState) => Evaluation
}

export type Quiz = {
  id: string
  modelId: string
  kind?: 'multiple-choice' | 'true-false'
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export type FlashcardGrade = 'again' | 'hard' | 'good' | 'easy'

export type FlashcardDiagram = {
  modelId: string
  variantId: string
  selectedStructureIds: string[]
}

export type Flashcard = {
  id: string
  kind: 'identify-structure' | 'structure-to-function' | 'fact-recall'
  front: { heading: string; body: string; diagram?: FlashcardDiagram }
  back: { heading: string; body: string }
}

export type FlashcardDeck = {
  id: string
  modelId: string
  contentVersion: string
  title: string
  description: string
  cards: Flashcard[]
  source?: 'default' | 'ai'
  visibility?: 'private' | 'public'
  owner?: boolean
  unlocked?: boolean
  unlockCost?: number
}

export type GeneratedDeckSummary = Omit<FlashcardDeck, 'cards'> & { cards?: Flashcard[]; createdAt: string }

export type FlashcardDeckProgress = {
  contentVersion: string
  cards: Record<string, { grade: FlashcardGrade; reviewCount: number; updatedAt: string; reviewId?: string }>
}

export type PendingFlashcardReview = {
  id: string
  deckId: string
  contentVersion: string
  cardId: string
  grade: FlashcardGrade
  reviewedAt: string
}

export type MaterialReleaseProgress = {
  contentVersion: string
  readSectionIds: string[]
  practiceAnswers: Record<string, number>
  practiceSubmitted: boolean
  updatedAt: string
}

export type Note = {
  id: string
  modelId: string
  hotspotId?: string
  text: string
  updatedAt: string
}

export type Settings = {
  autoRotate: boolean
  wireframe: boolean
  layers: boolean
  isolate: boolean
  labels: boolean
}

export type PersistedState = {
  selectedModelId: string
  selectedVariantIds: Record<string, string>
  completedLessonIds: string[]
  completedQuizIds: string[]
  favoriteModelIds: string[]
  bookmarkedHotspotRefs: string[]
  notes: Note[]
  selectedHotspotIds: Record<string, string>
  dissectionActionsByModel: Record<string, DissectionHistoryItem[]>
  dissectionByModel: Record<string, PersistedDissectionSession>
  flashcardProgressByDeck: Record<string, FlashcardDeckProgress>
  pendingFlashcardReviews: PendingFlashcardReview[]
  materialProgressByRelease: Record<string, MaterialReleaseProgress>
  materialProgressDirtyReleaseIds: string[]
  materialProgressOwnerId?: string
  settings: Settings
}

export type PersistedDissectionSession = {
  active: boolean
  hiddenIds: string[]
  transparentIds: string[]
  offsets: Record<string, [number, number, number]>
  isolate: boolean
  selectedIds: string[]
  visibleLayerIds: string[]
}

export type DissectionHistoryItem = {
  action: 'select' | 'hide' | 'show' | 'isolate' | 'transparent' | 'move' | 'reset'
  structureIds: string[]
  structures: string[]
  hiddenStructures: string[]
  createdAt: string
}

export type ChatItem = {
  id: string
  role: 'mentor' | 'student' | 'engine'
  text: string
  status?: 'pass' | 'fail' | 'neutral'
  pending?: boolean
}

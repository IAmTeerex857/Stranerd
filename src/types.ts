export type ViewId = 'explore' | 'systems' | 'lessons' | 'engineering' | 'library' | 'notes'

export type Hotspot = {
  id: string
  label: string
  detail: string
  position: [number, number, number]
}

export type ModelEntry = {
  id: string
  name: string
  scientificName: string
  system: string
  file: string
  variants: { id: string; label: string; file: string; note?: string }[]
  description: string
  facts: string[]
  metadata: { region: string; scale: string; focus: string }
  hotspots: Hotspot[]
  anatomy: boolean
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
  question: string
  options: string[]
  correctIndex: number
  explanation: string
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
}

export type PersistedState = {
  selectedModelId: string
  selectedVariantIds: Record<string, string>
  completedLessonIds: string[]
  completedQuizIds: string[]
  favoriteModelIds: string[]
  bookmarkedHotspotRefs: string[]
  notes: Note[]
  settings: Settings
}

export type ChatItem = {
  id: string
  role: 'mentor' | 'student' | 'engine'
  text: string
  status?: 'pass' | 'fail' | 'neutral'
}

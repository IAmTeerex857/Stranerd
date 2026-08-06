export type ViewId = 'explore' | 'systems' | 'lessons' | 'library' | 'notes'

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
  chatByModel: Record<string, ChatItem[]>
  selectedHotspotIds: Record<string, string>
  settings: Settings
}

export type ChatItem = {
  id: string
  role: 'mentor' | 'student' | 'engine'
  text: string
  status?: 'pass' | 'fail' | 'neutral'
  pending?: boolean
}

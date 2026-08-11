import { lazy, Suspense, useEffect, useEffectEvent, useMemo, useRef, useState, type SetStateAction } from 'react'
import { Bot, ChevronRight, CircleUserRound, FlaskConical, Library, Menu, PanelLeftClose, PanelLeftOpen, Search, Star, X } from 'lucide-react'
import { MentorPanel } from './components/MentorPanel'
import { anatomyModels, modelById, models } from './data/models'
import { quizzesForModel } from './data/quizzes'
import { loadState, saveState } from './lib/storage'
import type { ChatItem, FlashcardDeck, FlashcardGrade, GeneratedDeckSummary, Hotspot, ModelEntry, PersistedState, Quiz, ViewId } from './types'
import type { DissectionActionContext } from './data/dissection'
import { activityActionMatches, anatomyActivities, type AnatomyActivity } from './data/activities'
import { digestiveDissectionQuiz } from './data/dissection'
import { generateAICorrections, generateAIHint, generateAIQuiz } from './lib/quiz'
import { useAuth } from './auth-context'
import { AIActionError } from './lib/ai'
import type { CreditPrompt } from './components/CreditModal'
import { usePreferences } from './preferences-context'
import { flashcardDeckById } from './data/flashcards'
import { generateDeck, listGeneratedDecks, reportGeneratedDeck, unlockDeck, type GenerateDeckInput } from './lib/generatedFlashcards'
import { mergeFlashcardProgress, syncFlashcardProgress } from './lib/flashcardSync'
import { Button } from '@/components/ui/button'
import { anatomyLayers } from './data/anatomyGraph'
import type { AnatomyViewerController, ViewerVoiceState } from './components/AnatomyViewer'
import type { FlashcardsController, FlashcardVoiceState } from './components/FlashcardsView'
import type { VoiceAction, VoiceActionResult, VoiceMode } from './lib/voiceActions'
import type { ActiveNoteContext, LibraryContentMode, MaterialLearningController, MaterialLearningState, MaterialSubject, NoteSelectionRequest } from './types/materials'

const logoUrl = '/branding/stranerd-wordmark.png'
const iconUrl = '/branding/stranerd-icon.png'

const LibraryView = lazy(() => import('./components/WorkspaceViews').then((module) => ({ default: module.LibraryView })))
const QuizzesView = lazy(() => import('./components/WorkspaceViews').then((module) => ({ default: module.QuizzesView })))
const AnatomyViewer = lazy(() => import('./components/AnatomyViewer').then((module) => ({ default: module.AnatomyViewer })))
const DissectionActivitiesView = lazy(() => import('./components/DissectionActivitiesView').then((module) => ({ default: module.DissectionActivitiesView })))
const FlashcardsView = lazy(() => import('./components/FlashcardsView').then((module) => ({ default: module.FlashcardsView })))
const CreditModal = lazy(() => import('./components/CreditModal').then((module) => ({ default: module.CreditModal })))
const GenerateDeckModal = lazy(() => import('./components/GenerateDeckModal').then((module) => ({ default: module.GenerateDeckModal })))

function ViewLoading() {
  return <div className="view-loading" aria-label="Loading view"><span /><span /><span /></div>
}

const navItems: { id: ViewId; label: string; icon: typeof Search }[] = [
  { id: 'explore', label: 'Explore', icon: Search },
  { id: 'library', label: 'Learn', icon: Library },
  { id: 'lab', label: 'Lab', icon: FlaskConical },
]

const greeting: ChatItem = {
  id: 'mentor-welcome',
  role: 'mentor',
  text: 'Click a structure to explore it with me, open Learn for assessments, or enter Lab for guided dissection.',
}

function loadInitialState() {
  const state = loadState()
  const requestedModel = new URLSearchParams(window.location.search).get('model')
  return requestedModel && models.some((entry) => entry.id === requestedModel) ? { ...state, selectedModelId: requestedModel } : state
}

function loadAssessmentSeed() {
  const key = 'stranerd.assessment.seed.v1'
  const saved = Number(window.localStorage.getItem(key))
  if (Number.isInteger(saved) && saved > 0) return saved
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1
  window.localStorage.setItem(key, String(seed))
  return seed
}

function Brand() {
  return <div className="brand"><img className="brand-full" src={logoUrl} alt="Stranerd" /><img className="brand-icon" src={iconUrl} alt="" /><span>Interactive anatomy</span></div>
}

type DetailProps = {
  model: ModelEntry
  hotspot?: Hotspot
}

function ModelDetail({ model, hotspot }: DetailProps) {
  return <section className="model-detail brief-only panel anim2"><h2>{hotspot?.label || model.metadata.focus}</h2><p>{hotspot?.detail || model.description}</p></section>
}

export default function App() {
  const { user, balance, setBalance } = useAuth()
  const { reducedMotion } = usePreferences()
  const requestedDeckId = new URLSearchParams(window.location.search).get('deck') ?? undefined
  const requestedLibraryMode = new URLSearchParams(window.location.search).get('mode')
  const [persisted, setPersisted] = useState<PersistedState>(loadInitialState)
  const initialModel = modelById(persisted.selectedModelId)
  const initialHotspot = initialModel.hotspots.find((hotspot) => hotspot.id === persisted.selectedHotspotIds[initialModel.id])
  const initialDissection = persisted.dissectionByModel[initialModel.id]
  const [view, setView] = useState<ViewId>(() => {
    const requested = new URLSearchParams(window.location.search).get('view')
    return new URLSearchParams(window.location.search).has('subject') ? 'library' : navItems.some((item) => item.id === requested) ? requested as ViewId : 'explore'
  })
  const [selectedIds, setSelectedIds] = useState<string[]>(initialDissection?.active ? initialDissection.selectedIds : initialHotspot ? [initialHotspot.id] : [])
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | undefined>(initialHotspot)
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({})
  const [assessmentSubmitted, setAssessmentSubmitted] = useState(false)
  const [assessmentHints, setAssessmentHints] = useState<Record<number, string>>({})
  const [assessmentCorrections, setAssessmentCorrections] = useState<string[]>()
  const [loadingHintIndex, setLoadingHintIndex] = useState<number>()
  const [loadingCorrections, setLoadingCorrections] = useState(false)
  const [quizSeed, setQuizSeed] = useState(loadAssessmentSeed)
  const [generatedQuizSet, setGeneratedQuizSet] = useState<{ modelId: string; quizzes: Quiz[] }>()
  const [generatingQuiz, setGeneratingQuiz] = useState(false)
  const [quizGenerationError, setQuizGenerationError] = useState<string>()
  const [quizNeedsCredits, setQuizNeedsCredits] = useState(false)
  const [libraryMode, setLibraryMode] = useState<'catalog' | 'assessment' | 'flashcards'>(() => requestedDeckId && flashcardDeckById(requestedDeckId) ? 'flashcards' : requestedLibraryMode === 'assessment' ? 'assessment' : 'catalog')
  const [activeDeckId, setActiveDeckId] = useState<string | undefined>(() => requestedDeckId && flashcardDeckById(requestedDeckId) ? requestedDeckId : undefined)
  const [generatedDecks, setGeneratedDecks] = useState<GeneratedDeckSummary[]>([])
  const [generateModel, setGenerateModel] = useState<ModelEntry>()
  const [generatingDeck, setGeneratingDeck] = useState(false)
  const [deckError, setDeckError] = useState<string>()
  const [flashcardSyncError, setFlashcardSyncError] = useState(false)
  const [flashcardSyncRetry, setFlashcardSyncRetry] = useState(0)
  const [labMode, setLabMode] = useState<'catalog' | 'guided'>('catalog')
  const [activeActivityId, setActiveActivityId] = useState<string>()
  const [guidedActivityStep, setGuidedActivityStep] = useState<number | null>(null)
  const [activityQuizChoice, setActivityQuizChoice] = useState<number>()
  const [activityQuizPassed, setActivityQuizPassed] = useState<boolean>()
  const [typing, setTyping] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mentorOpen, setMentorOpen] = useState(false)
  const [creditPrompt, setCreditPrompt] = useState<CreditPrompt>()
  const [viewerVoiceState, setViewerVoiceState] = useState<ViewerVoiceState>()
  const [flashcardVoiceState, setFlashcardVoiceState] = useState<FlashcardVoiceState>()
  const [libraryContentMode, setLibraryContentMode] = useState<LibraryContentMode>(() => { const content = new URLSearchParams(window.location.search).get('content'); return content === 'practice' || content === 'tests' ? 'practice' : content === 'flashcards' ? 'flashcards' : 'notes' })
  const [activeNoteContext, setActiveNoteContext] = useState<ActiveNoteContext>()
  const [noteMentorRequest, setNoteMentorRequest] = useState<NoteSelectionRequest>()
  const [materialLearningState, setMaterialLearningState] = useState<MaterialLearningState>()
  const viewerController = useRef<AnatomyViewerController>(null)
  const flashcardsController = useRef<FlashcardsController>(null)
  const materialLearningController = useRef<MaterialLearningController | undefined>(undefined)
  const model = modelById(persisted.selectedModelId)
  const messages = persisted.chatByModel[model.id] ?? [greeting]
  const fallbackQuizzes = useMemo(() => quizzesForModel(model.id, quizSeed), [model.id, quizSeed])
  const modelQuizzes = generatedQuizSet?.modelId === model.id ? generatedQuizSet.quizzes : fallbackQuizzes
  const savedVariantId = persisted.selectedVariantIds[model.id]
  const selectedVariantId = model.variants.some((variant) => variant.id === savedVariantId) ? savedVariantId! : model.variants[0].id
  const favorite = persisted.favoriteModelIds.includes(model.id)
  const sideModels = anatomyModels
  const effectiveSidebarCollapsed = sidebarCollapsed || (view === 'lab' && labMode !== 'catalog')
  const mentorAvailable = view === 'explore' || (view === 'lab' && labMode !== 'catalog')
  const assistantAvailable = mentorAvailable || (view === 'library' && (libraryMode === 'assessment' || libraryMode === 'flashcards' || Boolean(materialLearningState) || (libraryContentMode === 'notes' && Boolean(activeNoteContext))))
  const pendingFlashcardReviewKey = persisted.pendingFlashcardReviews.map((review) => review.id).join(':')

  useEffect(() => {
    saveState(persisted)
  }, [persisted])

  useEffect(() => {
    if (!user) return
    let active = true
    void listGeneratedDecks().then((decks) => { if (active) setGeneratedDecks(decks) }).catch(() => { if (active) setGeneratedDecks([]) })
    return () => { active = false }
  }, [user])

  const syncSignedInProgress = useEffectEvent(async () => {
    try {
      const result = await syncFlashcardProgress(persisted.flashcardProgressByDeck, persisted.pendingFlashcardReviews)
      const acknowledged = new Set(result.acknowledgedIds)
      setPersisted((current) => ({
        ...current,
        flashcardProgressByDeck: mergeFlashcardProgress(current.flashcardProgressByDeck, result.rows),
        pendingFlashcardReviews: current.pendingFlashcardReviews.filter((review) => !acknowledged.has(review.id)),
      }))
      setFlashcardSyncError(false)
    } catch {
      setFlashcardSyncError(true)
    }
  })

  useEffect(() => {
    if (!user) return
    const timer = window.setTimeout(() => void syncSignedInProgress(), 0)
    return () => window.clearTimeout(timer)
  }, [flashcardSyncRetry, pendingFlashcardReviewKey, user])

  useEffect(() => {
    const retry = () => setFlashcardSyncRetry((value) => value + 1)
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])

  useEffect(() => {
    if (!menuOpen || window.innerWidth > 760) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [menuOpen])

  function updatePersisted(next: Partial<PersistedState>) {
    setPersisted((current) => ({ ...current, ...next }))
  }

  function setMessages(action: SetStateAction<ChatItem[]>) {
    setPersisted((current) => {
      const currentMessages = current.chatByModel[current.selectedModelId] ?? [greeting]
      const nextMessages = typeof action === 'function' ? action(currentMessages) : action
      return { ...current, chatByModel: { ...current.chatByModel, [current.selectedModelId]: nextMessages.slice(-100) } }
    })
  }

  function selectModel(next: ModelEntry) {
    updatePersisted({ selectedModelId: next.id })
    const restoredHotspot = next.hotspots.find((hotspot) => hotspot.id === persisted.selectedHotspotIds[next.id])
    const restoredDissection = persisted.dissectionByModel[next.id]
    setSelectedIds(restoredDissection?.active ? restoredDissection.selectedIds : restoredHotspot ? [restoredHotspot.id] : [])
    setSelectedHotspot(restoredHotspot)
    setQuizIndex(0)
    resetAssessment()
    setGeneratedQuizSet(undefined)
    setActiveActivityId(undefined)
    setLabMode('catalog')
    setGuidedActivityStep(null)
    setLibraryMode('catalog')
    setView('explore')
    setMenuOpen(false)
  }

  function clearSelection() {
    setSelectedIds([])
    setSelectedHotspot(undefined)
    setPersisted((current) => {
      const selectedHotspotIds = { ...current.selectedHotspotIds }
      delete selectedHotspotIds[current.selectedModelId]
      return { ...current, selectedHotspotIds }
    })
  }

  function selectVariant(variantId: string) {
    updatePersisted({ selectedVariantIds: { ...persisted.selectedVariantIds, [model.id]: variantId } })
    setSelectedIds([])
    setSelectedHotspot(undefined)
  }

  function selectHotspot(hotspot: Hotspot, multi: boolean, explain = true) {
    setSelectedHotspot(hotspot)
    updatePersisted({ selectedHotspotIds: { ...persisted.selectedHotspotIds, [model.id]: hotspot.id } })
    setSelectedIds((current) => multi ? (current.includes(hotspot.id) ? current.filter((id) => id !== hotspot.id) : [...current, hotspot.id]) : [hotspot.id])
    const activeActivity = anatomyActivities.find((activity) => activity.id === activeActivityId && activity.modelId === model.id)
    const activeStep = guidedActivityStep === null ? undefined : activeActivity?.steps[guidedActivityStep]
    const completesGuidedSelection = view === 'lab' && labMode === 'guided'
      && activeStep !== undefined && activityActionMatches(activeStep, 'select', [hotspot.id])
    if (completesGuidedSelection && guidedActivityStep !== null) {
      setGuidedActivityStep(guidedActivityStep + 1)
      setActivityQuizChoice(undefined)
      setActivityQuizPassed(undefined)
    }
    if (multi || !explain) return
  }

  function explainDissectionAction(context: DissectionActionContext) {
    setPersisted((current) => ({
      ...current,
      dissectionActionsByModel: {
        ...current.dissectionActionsByModel,
        [model.id]: [...(current.dissectionActionsByModel[model.id] ?? []), {
          action: context.action,
          structureIds: context.structureIds,
          structures: context.structures,
          hiddenStructures: context.hiddenStructures,
          createdAt: new Date().toISOString(),
        }].slice(-30),
      },
    }))
    const activeActivity = anatomyActivities.find((activity) => activity.id === activeActivityId && activity.modelId === model.id)
    const activeStep = guidedActivityStep === null ? undefined : activeActivity?.steps[guidedActivityStep]
    const session = persisted.dissectionByModel[model.id]
    const actionApplied = context.action === 'transparent'
      ? !context.structureIds.every((id) => session?.transparentIds.includes(id))
      : context.action === 'isolate' ? !session?.isolate : true
    const stepComplete = Boolean(activeStep && activityActionMatches(activeStep, context.action, context.structureIds, actionApplied))
    if (stepComplete && activeStep?.kind === 'action' && guidedActivityStep !== null) {
      context = { ...context, guidedStep: activeStep.prompt }
      setGuidedActivityStep(guidedActivityStep + 1)
      setActivityQuizChoice(undefined)
      setActivityQuizPassed(undefined)
    }
    const target = context.structures.join(', ') || `the ${model.name.toLowerCase()} model`
    const completed = Boolean(context.guidedStep)
    setMessages((current) => [...current, {
      id: crypto.randomUUID(),
      role: 'engine',
      text: `${completed ? 'STEP COMPLETE' : 'DISSECTION'} · ${context.action.toUpperCase()} · ${target}`,
      status: completed ? 'pass' : 'neutral',
    }])
  }

  function chooseView(next: ViewId) {
    setView(next)
    if (next === 'library') setLibraryMode('catalog')
    if (next === 'lab') {
      setLabMode('catalog')
      setActiveActivityId(undefined)
      setGuidedActivityStep(null)
    }
    setMenuOpen(false)
  }

  function toggleFavorite(modelId: string) {
    const exists = persisted.favoriteModelIds.includes(modelId)
    updatePersisted({ favoriteModelIds: exists ? persisted.favoriteModelIds.filter((id) => id !== modelId) : [...persisted.favoriteModelIds, modelId] })
  }

  function saveDissectionSession(session: PersistedState['dissectionByModel'][string]) {
    setPersisted((current) => ({
      ...current,
      dissectionByModel: { ...current.dissectionByModel, [model.id]: session },
    }))
  }

  function chooseQuiz(index: number) {
    setQuizIndex(index)
  }

  function resetAssessment() {
    setQuizIndex(0)
    setQuizAnswers({})
    setAssessmentSubmitted(false)
    setAssessmentHints({})
    setAssessmentCorrections(undefined)
    setLoadingHintIndex(undefined)
    setLoadingCorrections(false)
    setQuizGenerationError(undefined)
    setQuizNeedsCredits(false)
  }

  function submitAssessment() {
    if (Object.keys(quizAnswers).length !== modelQuizzes.length) return
    const passedIds = modelQuizzes.filter((entry, index) => quizAnswers[index] === entry.correctIndex).map((entry) => entry.id)
    updatePersisted({ completedQuizIds: [...new Set([...persisted.completedQuizIds, ...passedIds])] })
    setAssessmentSubmitted(true)
    window.requestAnimationFrame(() => document.querySelector('.assessment-result')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' }))
  }

  async function takeNewAIQuiz() {
    if (generatingQuiz) return
    if (!user) {
      window.location.assign(`/login?next=${encodeURIComponent(`/app?model=${model.id}`)}`)
      return
    }
    setGeneratingQuiz(true)
    setQuizGenerationError(undefined)
    setQuizNeedsCredits(false)
    const nextSeed = crypto.getRandomValues(new Uint32Array(1))[0]
    try {
      const result = await generateAIQuiz(model, modelQuizzes.map((quiz) => quiz.question))
      setBalance(result.balance)
      setQuizSeed(nextSeed)
      setGeneratedQuizSet({ modelId: model.id, quizzes: result.quizzes })
      resetAssessment()
    } catch (error) {
      if (error instanceof AIActionError && error.balance) setBalance(error.balance)
      if (error instanceof AIActionError && error.code === 'insufficient_credits') setCreditPrompt({ action: 'A new assessment', required: 5 })
      setQuizNeedsCredits(error instanceof AIActionError && error.code === 'insufficient_credits')
      setQuizGenerationError(error instanceof Error ? error.message : 'The AI quiz could not be generated. No credit was charged.')
    } finally {
      setGeneratingQuiz(false)
    }
  }

  async function requestAssessmentHint(index: number) {
    if (loadingHintIndex !== undefined || assessmentHints[index]) return false
    if (!user) {
      window.location.assign(`/login?next=${encodeURIComponent(`/app?model=${model.id}`)}`)
      return false
    }
    setLoadingHintIndex(index)
    setQuizGenerationError(undefined)
    setQuizNeedsCredits(false)
    try {
      const result = await generateAIHint(model, modelQuizzes[index])
      setBalance(result.balance)
      setAssessmentHints((current) => ({ ...current, [index]: result.hint }))
      return true
    } catch (error) {
      if (error instanceof AIActionError && error.balance) setBalance(error.balance)
      if (error instanceof AIActionError && error.code === 'insufficient_credits') setCreditPrompt({ action: 'An assessment hint', required: 1 })
      setQuizNeedsCredits(error instanceof AIActionError && error.code === 'insufficient_credits')
      setQuizGenerationError(error instanceof Error ? error.message : 'The hint could not be generated. No credit was charged.')
      return false
    } finally {
      setLoadingHintIndex(undefined)
    }
  }

  async function requestAssessmentCorrections() {
    if (!assessmentSubmitted || loadingCorrections || assessmentCorrections) return
    if (!user) {
      window.location.assign(`/login?next=${encodeURIComponent(`/app?model=${model.id}`)}`)
      return
    }
    setLoadingCorrections(true)
    setQuizGenerationError(undefined)
    setQuizNeedsCredits(false)
    try {
      const answers = modelQuizzes.map((_, index) => quizAnswers[index] ?? null)
      const result = await generateAICorrections(model, modelQuizzes, answers)
      setBalance(result.balance)
      setAssessmentCorrections(result.corrections)
    } catch (error) {
      if (error instanceof AIActionError && error.balance) setBalance(error.balance)
      if (error instanceof AIActionError && error.code === 'insufficient_credits') setCreditPrompt({ action: 'Detailed assessment corrections', required: 2 })
      setQuizNeedsCredits(error instanceof AIActionError && error.code === 'insufficient_credits')
      setQuizGenerationError(error instanceof Error ? error.message : 'Corrections could not be generated. No credit was charged.')
    } finally {
      setLoadingCorrections(false)
    }
  }

  function launchDissectionActivity(activity: AnatomyActivity) {
    const nextModel = modelById(activity.modelId)
    const segmented = nextModel.variants.find((variant) => variant.segmentedSystem)
    setPersisted((current) => ({
      ...current,
      selectedModelId: nextModel.id,
      selectedVariantIds: segmented ? { ...current.selectedVariantIds, [nextModel.id]: segmented.id } : current.selectedVariantIds,
      settings: current.settings.isolate ? { ...current.settings, isolate: false } : current.settings,
      dissectionByModel: Object.fromEntries(Object.entries(current.dissectionByModel).filter(([modelId]) => modelId !== nextModel.id)),
    }))
    setSelectedIds([])
    setSelectedHotspot(undefined)
    setActiveActivityId(activity.id)
    setLabMode('guided')
    setGuidedActivityStep(null)
    setActivityQuizChoice(undefined)
    setActivityQuizPassed(undefined)
    setView('lab')
    resetAssessment()
    setGeneratedQuizSet(undefined)
  }

  function openAssessment(next: ModelEntry) {
    selectModel(next)
    setLibraryMode('assessment')
    setView('library')
  }

  function openFlashcards(deck: FlashcardDeck) {
    selectModel(modelById(deck.modelId))
    setActiveDeckId(deck.id)
    setLibraryMode('flashcards')
    setView('library')
  }

  function gradeFlashcard(cardId: string, grade: FlashcardGrade) {
    if (!activeDeckId) return
    const generated = generatedDecks.find((entry) => entry.id === activeDeckId && entry.cards)
    const deck = flashcardDeckById(activeDeckId) ?? (generated?.cards ? { ...generated, cards: generated.cards } : undefined)
    if (!deck || !deck.cards.some((card) => card.id === cardId)) return
    const review = { id: crypto.randomUUID(), deckId: deck.id, contentVersion: deck.contentVersion, cardId, grade, reviewedAt: new Date().toISOString() }
    setPersisted((current) => {
      const existing = current.flashcardProgressByDeck[deck.id]?.contentVersion === deck.contentVersion ? current.flashcardProgressByDeck[deck.id] : undefined
      const previous = existing?.cards[cardId]
      const reviewCount = (previous?.reviewCount ?? 0) + 1
      return {
        ...current,
        pendingFlashcardReviews: [...current.pendingFlashcardReviews, review],
        flashcardProgressByDeck: {
          ...current.flashcardProgressByDeck,
          [deck.id]: {
            contentVersion: deck.contentVersion,
            cards: {
              ...(existing?.cards ?? {}),
              [cardId]: { grade, reviewCount, updatedAt: review.reviewedAt, reviewId: review.id },
            },
          },
        },
      }
    })
  }

  function gradeMaterialFlashcard(subject: MaterialSubject, cardId: string, grade: FlashcardGrade) {
    const deckId = `materials:${subject.releaseId}`
    const review = { id: crypto.randomUUID(), deckId, contentVersion: subject.contentVersion, cardId, grade, reviewedAt: new Date().toISOString() }
    setPersisted((current) => {
      const existing = current.flashcardProgressByDeck[deckId]?.contentVersion === subject.contentVersion ? current.flashcardProgressByDeck[deckId] : undefined
      const previous = existing?.cards[cardId]
      const reviewCount = (previous?.reviewCount ?? 0) + 1
      return { ...current, pendingFlashcardReviews: [...current.pendingFlashcardReviews, review], flashcardProgressByDeck: { ...current.flashcardProgressByDeck, [deckId]: { contentVersion: subject.contentVersion, cards: { ...(existing?.cards ?? {}), [cardId]: { grade, reviewCount, updatedAt: review.reviewedAt, reviewId: review.id } } } } }
    })
  }

  async function createGeneratedDeck(input: GenerateDeckInput) {
    if (!user) { window.location.assign('/login?next=/app'); return }
    setGeneratingDeck(true)
    setDeckError(undefined)
    try {
      const result = await generateDeck(input)
      setBalance(result.balance)
      const summary: GeneratedDeckSummary = { ...result.deck, cards: result.deck.cards, createdAt: new Date().toISOString(), owner: true, unlocked: true }
      setGeneratedDecks((current) => [summary, ...current.filter((deck) => deck.id !== summary.id)])
      setGenerateModel(undefined)
      setActiveDeckId(summary.id)
      setLibraryMode('flashcards')
    } catch (error) {
      if (error instanceof AIActionError && error.balance) setBalance(error.balance)
      if (error instanceof AIActionError && error.code === 'insufficient_credits') setCreditPrompt({ action: 'A new 15-card flashcard deck', required: 5 })
      setDeckError(error instanceof Error ? error.message : 'The deck could not be generated. No credit was charged.')
    } finally {
      setGeneratingDeck(false)
    }
  }

  function openGeneratedDeck(deck: GeneratedDeckSummary) {
    if (!deck.cards) return
    setActiveDeckId(deck.id)
    setLibraryMode('flashcards')
  }

  async function unlockGeneratedDeck(deck: GeneratedDeckSummary) {
    if (!user) { window.location.assign('/login?next=/app'); return }
    setDeckError(undefined)
    try {
      const result = await unlockDeck(deck.id)
      setBalance(result.balance)
      const refreshed = await listGeneratedDecks()
      setGeneratedDecks(refreshed)
      const unlocked = refreshed.find((entry) => entry.id === deck.id)
      if (unlocked?.cards) openGeneratedDeck(unlocked)
    } catch (error) {
      if (error instanceof AIActionError && error.balance) setBalance(error.balance)
      if (error instanceof AIActionError && error.code === 'insufficient_credits') setCreditPrompt({ action: 'This community flashcard deck', required: 5 })
      else setDeckError(error instanceof Error ? error.message : 'The deck could not be unlocked.')
    }
  }

  async function reportDeck(deck: GeneratedDeckSummary) {
    if (!window.confirm(`Report “${deck.title}” for inaccurate or unsafe content?`)) return
    try {
      await reportGeneratedDeck(deck.id, 'inaccurate')
      setDeckError('Report submitted. The deck remains available while it is reviewed.')
    } catch (error) {
      setDeckError(error instanceof Error ? error.message : 'The report could not be submitted.')
    }
  }

  function returnToLabCatalog() {
    setLabMode('catalog')
    setActiveActivityId(undefined)
    setGuidedActivityStep(null)
    setActivityQuizChoice(undefined)
    setActivityQuizPassed(undefined)
  }

  function checkActivityQuestion() {
    const activity = anatomyActivities.find((entry) => entry.id === activeActivityId)
    if (!activity || guidedActivityStep === null || activityQuizChoice === undefined) return
    const step = activity.steps[guidedActivityStep]
    const correctIndex = step?.kind === 'question' ? step.correctIndex : digestiveDissectionQuiz.correctIndex
    setActivityQuizPassed(activityQuizChoice === correctIndex)
  }

  function continueActivity() {
    if (!activityQuizPassed || guidedActivityStep === null) return
    setGuidedActivityStep(guidedActivityStep + 1)
    setActivityQuizChoice(undefined)
    setActivityQuizPassed(undefined)
  }

  async function handleVoiceAction(action: VoiceAction): Promise<VoiceActionResult> {
    if (view === 'library' && libraryMode === 'catalog' && libraryContentMode === 'notes') return { ok: false, error: 'Notes are read-only and have no voice mutation actions.' }
    if (view === 'library' && libraryMode === 'catalog' && materialLearningState) {
      const controller = materialLearningController.current
      if (!controller || controller.target !== materialLearningState.target) return { ok: false, error: 'The material learning controls are still loading.' }
      if (materialLearningState.target === 'material-practice' && action.type.startsWith('assessment.')) return controller.executeVoiceAction(action as Extract<VoiceAction, { type: `assessment.${string}` }>)
      if (materialLearningState.target === 'material-flashcards' && (action.type.startsWith('flashcard.') || action.type === 'materialFlashcard.hint')) return controller.executeVoiceAction(action as Extract<VoiceAction, { type: `flashcard.${string}` | `materialFlashcard.${string}` }>)
      return { ok: false, error: 'That voice action does not apply to the open material.' }
    }
    if (action.type === 'materialFlashcard.hint') return { ok: false, error: 'Paid hints are available for imported material flashcards.' }
    if (action.type.startsWith('viewer.')) {
      if (view !== 'explore' && !(view === 'lab' && labMode !== 'catalog')) return { ok: false, error: 'The anatomy canvas is not open.' }
      return viewerController.current?.executeVoiceAction(action as Extract<VoiceAction, { type: `viewer.${string}` }>) ?? { ok: false, error: 'The anatomy canvas is still loading.' }
    }
    if (action.type.startsWith('assessment.')) {
      if (view !== 'library' || libraryMode !== 'assessment') return { ok: false, error: 'A practice test is not open.' }
      if (action.type === 'assessment.select') {
        if (assessmentSubmitted) return { ok: false, error: 'This assessment has already been submitted.' }
        const quiz = modelQuizzes[quizIndex]
        if (!quiz || action.optionIndex < 0 || action.optionIndex >= quiz.options.length) return { ok: false, error: 'That option is not available for this question.' }
        setQuizAnswers((current) => ({ ...current, [quizIndex]: action.optionIndex }))
        return { ok: true, message: `Option ${String.fromCharCode(65 + action.optionIndex)} selected for question ${quizIndex + 1}.` }
      }
      if (action.type === 'assessment.navigate') {
        const next = quizIndex + (action.direction === 'next' ? 1 : -1)
        if (next < 0 || next >= modelQuizzes.length) return { ok: false, error: `There is no ${action.direction} question.` }
        chooseQuiz(next)
        return { ok: true, message: `Moved to question ${next + 1}.` }
      }
      if (action.type === 'assessment.hint') {
        if (assessmentSubmitted) return { ok: false, error: 'Hints are unavailable after submission.' }
        if (assessmentHints[quizIndex]) return { ok: true, message: 'The hint is already visible.' }
        if (!window.confirm('Spend 1 credit to generate a hint for this question?')) return { ok: false, error: 'The learner did not confirm the hint charge.' }
        const generated = await requestAssessmentHint(quizIndex)
        return generated ? { ok: true, message: 'The hint is now visible.' } : { ok: false, error: 'The hint could not be generated.' }
      }
      if (assessmentSubmitted) return { ok: false, error: 'This assessment has already been submitted.' }
      if (Object.keys(quizAnswers).length !== modelQuizzes.length) return { ok: false, error: 'Answer every question before submitting.' }
      if (!window.confirm('Submit this assessment for final grading?')) return { ok: false, error: 'The learner did not confirm assessment submission.' }
      submitAssessment()
      return { ok: true, message: 'Assessment submitted.' }
    }
    if (view !== 'library' || libraryMode !== 'flashcards') return { ok: false, error: 'A flashcard deck is not open.' }
    return flashcardsController.current?.executeVoiceAction(action as Extract<VoiceAction, { type: `flashcard.${string}` }>) ?? { ok: false, error: 'The flashcard is still loading.' }
  }

  const viewer = <AnatomyViewer ref={viewerController} key={`${model.id}:${view === 'lab' ? `${labMode}:${activeActivityId || ''}` : 'explore'}`} model={model} selectedIds={selectedIds} selectedHotspot={selectedHotspot} settings={persisted.settings} selectedVariantId={selectedVariantId} favorite={favorite} onSelect={selectHotspot} onClearSelection={clearSelection} onSettings={(settings) => updatePersisted({ settings })} onVariant={selectVariant} onFavorite={() => toggleFavorite(model.id)} onDissectionAction={explainDissectionAction} dissectionSession={persisted.dissectionByModel[model.id]} onDissectionState={saveDissectionSession} onVoiceState={setViewerVoiceState} initialDissect={view === 'lab' && labMode !== 'catalog'} activityLayout={view === 'lab' && labMode !== 'catalog'} guidedStep={guidedActivityStep} onGuidedStep={setGuidedActivityStep} />
  const quizView = <QuizzesView model={model} quizzes={modelQuizzes} quizIndex={quizIndex} answers={quizAnswers} submitted={assessmentSubmitted} hints={assessmentHints} corrections={assessmentCorrections} loadingHintIndex={loadingHintIndex} loadingCorrections={loadingCorrections} onQuiz={chooseQuiz} onAnswer={(index) => setQuizAnswers((current) => ({ ...current, [quizIndex]: index }))} onSubmit={submitAssessment} onHint={requestAssessmentHint} onNewAssessment={takeNewAIQuiz} onCorrections={requestAssessmentCorrections} generatingAssessment={generatingQuiz} aiError={quizGenerationError} aiNeedsCredits={quizNeedsCredits} signedIn={Boolean(user)} creditBalance={balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : undefined} onBack={() => setLibraryMode('catalog')} />
  const generatedActiveDeck = generatedDecks.find((deck) => deck.id === activeDeckId && deck.cards)
  const activeDeck = activeDeckId ? flashcardDeckById(activeDeckId) ?? (generatedActiveDeck?.cards ? { ...generatedActiveDeck, cards: generatedActiveDeck.cards } : undefined) : undefined
  const voiceMode: VoiceMode = view === 'lab' ? 'lab' : view === 'library' ? libraryMode === 'flashcards' || materialLearningState?.target === 'material-flashcards' ? 'flashcard' : libraryMode === 'assessment' || materialLearningState?.target === 'material-practice' ? 'assessment' : 'notes' : 'mentor'
  const voiceContext = (() => {
    if (voiceMode === 'notes') return { screen: 'notes', note: activeNoteContext }
    const activeActivity = anatomyActivities.find((activity) => activity.id === activeActivityId)
    const step = guidedActivityStep === null ? undefined : activeActivity?.steps[guidedActivityStep]
    return {
      screen: voiceMode,
      model: { id: model.id, name: model.name, variantId: selectedVariantId, variants: model.variants.map(({ id, label }) => ({ id, label })), system: model.system, facts: model.facts.slice(0, 5) },
      selectedStructure: selectedHotspot ? { id: selectedHotspot.id, label: selectedHotspot.label, detail: selectedHotspot.detail } : null,
      recentActions: (persisted.dissectionActionsByModel[model.id] ?? []).slice(-10).map(({ action, structureIds, structures }) => ({ action, structureIds, structures })),
      viewer: voiceMode === 'mentor' || voiceMode === 'lab' ? { settings: persisted.settings, layers: model.viewer === 'segmented-body' ? anatomyLayers.map(({ id, label }) => ({ id, label, visible: viewerVoiceState?.visibleLayerIds.includes(id) ?? false })) : [], state: viewerVoiceState ? { ...viewerVoiceState, structures: viewerVoiceState.structures.slice(0, 50) } : undefined } : undefined,
      lab: voiceMode === 'lab' ? { activityId: activeActivityId, stepIndex: guidedActivityStep, prompt: step?.prompt, validated: activityQuizPassed } : undefined,
      assessment: voiceMode === 'assessment' ? materialLearningState?.target === 'material-practice' ? { questionId: materialLearningState.questionId, index: materialLearningState.index, count: materialLearningState.count, question: materialLearningState.question, options: materialLearningState.options, selectedIndex: materialLearningState.selectedIndex, submitted: materialLearningState.submitted, hint: materialLearningState.hint } : { questionId: modelQuizzes[quizIndex]?.id, index: quizIndex, count: modelQuizzes.length, question: modelQuizzes[quizIndex]?.question, options: modelQuizzes[quizIndex]?.options, selectedIndex: quizAnswers[quizIndex] ?? null, submitted: assessmentSubmitted, hint: assessmentHints[quizIndex] } : undefined,
      flashcard: voiceMode === 'flashcard' ? materialLearningState?.target === 'material-flashcards' ? { deckId: materialLearningState.deckId, cardId: materialLearningState.cardId, index: materialLearningState.index, count: materialLearningState.count, side: materialLearningState.side, graded: materialLearningState.graded, question: materialLearningState.question, answer: materialLearningState.answer, hint: materialLearningState.hint } : flashcardVoiceState : undefined,
    }
  })()
  const detail = <ModelDetail model={model} hotspot={selectedHotspot} />

  function renderCenter() {
    if (view === 'library') {
      if (libraryMode === 'assessment') return quizView
      if (libraryMode === 'flashcards' && activeDeck) return <FlashcardsView key={activeDeck.id} ref={flashcardsController} deck={activeDeck} progress={persisted.flashcardProgressByDeck[activeDeck.id]} onGrade={gradeFlashcard} onVoiceState={setFlashcardVoiceState} onBack={() => setLibraryMode('catalog')} />
      return <LibraryView onAssessment={openAssessment} onFlashcards={openFlashcards} onGeneratedDeck={openGeneratedDeck} onUnlockDeck={unlockGeneratedDeck} onReportDeck={reportDeck} onMaterialGrade={gradeMaterialFlashcard} onModeChange={(mode) => { setLibraryContentMode(mode); if (mode !== 'notes') setActiveNoteContext(undefined) }} onNoteContext={setActiveNoteContext} onNoteRequest={(prompt) => { setNoteMentorRequest({ id: crypto.randomUUID(), prompt }); setMentorOpen(true) }} onMaterialLearningState={setMaterialLearningState} onMaterialLearningController={(controller) => { materialLearningController.current = controller }} onBalance={setBalance} onInsufficientCredits={(action, required) => setCreditPrompt({ action, required })} onSignIn={() => window.location.assign('/login?next=/app')} signedIn={Boolean(user)} creditBalance={balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : undefined} generatedDecks={generatedDecks} generatedError={deckError} completedQuizIds={persisted.completedQuizIds} flashcardProgressByDeck={persisted.flashcardProgressByDeck} />
    }
    if (view === 'lab') {
      const lab = <DissectionActivitiesView mode={labMode} activeActivityId={activeActivityId} onGuided={launchDissectionActivity} onCatalog={returnToLabCatalog} guidedStep={guidedActivityStep} quizChoice={activityQuizChoice} quizPassed={activityQuizPassed} onStartGuide={() => { setGuidedActivityStep(0); setActivityQuizChoice(undefined); setActivityQuizPassed(undefined) }} onQuizChoice={(choice) => { setActivityQuizChoice(choice); setActivityQuizPassed(undefined) }} onQuizCheck={checkActivityQuestion} onStepContinue={continueActivity} />
      return labMode === 'catalog' ? lab : <div className="lesson-workspace activity-workspace">{viewer}<div className="activity-pane">{lab}</div></div>
    }
    return <div className="explore-view">{viewer}{detail}</div>
  }

  return <div className={`app-shell ${effectiveSidebarCollapsed ? 'sidebar-collapsed' : ''} ${!assistantAvailable ? 'mentor-hidden' : ''}`}>
    <header className="mobile-head"><Brand /><button onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen} aria-controls="app-sidebar">{menuOpen ? <X /> : <Menu />}</button></header>
    <aside id="app-sidebar" className={`sidebar ${menuOpen ? 'open' : ''} ${effectiveSidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="side-brand"><Brand /><button onClick={() => setSidebarCollapsed((value) => !value)} aria-label={effectiveSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}>{effectiveSidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
      <nav>{navItems.map((item) => <Button variant="ghost" key={item.id} className={view === item.id ? 'active' : ''} onClick={() => chooseView(item.id)} aria-current={view === item.id ? 'page' : undefined} title={effectiveSidebarCollapsed ? item.label : undefined}><item.icon size={18} /><span>{item.label}</span></Button>)}</nav>
      <div className="side-section"><header><span>Anatomy models</span></header><div className="model-list">{sideModels.map((entry) => <Button variant="ghost" key={entry.id} className={entry.id === model.id ? 'active' : ''} onClick={() => selectModel(entry)}><i /><span>{entry.name}</span>{persisted.favoriteModelIds.includes(entry.id) && <Star size={11} fill="currentColor" />}<ChevronRight size={14} /></Button>)}</div></div>
    </aside>
    <main className="workspace">
      <header className="topbar"><div><span>{view === 'library' ? 'Learn' : view}</span><ChevronRight size={13} /><b>{model.name}</b></div><div className="top-actions">{flashcardSyncError && <Button variant="outline" role="alert" onClick={() => setFlashcardSyncRetry((value) => value + 1)}>Progress not synced · Retry</Button>}<Button variant="outline" asChild><a href="/account"><CircleUserRound size={16} />Account</a></Button>{view !== 'lab' && <Button onClick={() => chooseView('lab')}><FlaskConical size={16} />Open Lab</Button>}</div></header>
      <div className="center-pane"><Suspense fallback={<ViewLoading />}>{renderCenter()}</Suspense></div>
    </main>
    {assistantAvailable && <MentorPanel model={model} selectedHotspot={selectedHotspot} actionHistory={persisted.dissectionActionsByModel[model.id] ?? []} messages={messages} typing={typing} onMessages={setMessages} onTyping={setTyping} mobileOpen={mentorOpen} onMobileClose={() => setMentorOpen(false)} onInsufficientCredits={() => setCreditPrompt({ action: 'An AI Mentor response', required: 1 })} noteContext={activeNoteContext} draftRequest={noteMentorRequest} voiceMode={voiceMode} voiceContext={voiceContext} onVoiceAction={handleVoiceAction} onVoiceInsufficientCredits={() => setCreditPrompt({ action: 'A five-minute Voice session', required: 10 })} />}
    <nav className="mobile-tabs" aria-label="Workspace navigation">{navItems.map((item) => <Button variant="ghost" key={item.id} className={view === item.id ? 'active' : ''} onClick={() => chooseView(item.id)} aria-current={view === item.id ? 'page' : undefined}><item.icon size={18} /><span>{item.label}</span></Button>)}</nav>
    {assistantAvailable && <button className="mobile-mentor-button" onClick={() => setMentorOpen(true)} aria-expanded={mentorOpen} aria-controls="stranerd-mentor"><Bot size={15} />Mentor{typing && <i />}</button>}
    {creditPrompt && <Suspense fallback={null}><CreditModal prompt={creditPrompt} balance={balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : 0} onClose={() => setCreditPrompt(undefined)} /></Suspense>}
    {generateModel && <Suspense fallback={null}><GenerateDeckModal model={generateModel} balance={balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : 0} generating={generatingDeck} error={deckError} onClose={() => setGenerateModel(undefined)} onGenerate={createGeneratedDeck} /></Suspense>}
  </div>
}

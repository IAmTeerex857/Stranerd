import { useEffect, useEffectEvent, useMemo, useState, type SetStateAction } from 'react'
import { Bot, ChevronRight, CircleUserRound, FlaskConical, Library, Menu, PanelLeftClose, PanelLeftOpen, Search, Star, X } from 'lucide-react'
import { AnatomyViewer } from './components/AnatomyViewer'
import { MentorPanel } from './components/MentorPanel'
import { LibraryView, QuizzesView } from './components/WorkspaceViews'
import { anatomyModels, modelById, models } from './data/models'
import logoUrl from '../Logo Stranerd.png'
import iconUrl from '../Icon Logo Stranerd.png'
import { allQuizzes, quizzesForModel } from './data/quizzes'
import { loadState, saveState } from './lib/storage'
import type { ChatItem, FlashcardDeck, FlashcardGrade, GeneratedDeckSummary, Hotspot, ModelEntry, PersistedState, Quiz, ViewId } from './types'
import type { DissectionActionContext } from './data/dissection'
import { DissectionActivitiesView } from './components/DissectionActivitiesView'
import { anatomyActivities, type AnatomyActivity } from './data/activities'
import { digestiveDissectionQuiz } from './data/dissection'
import { generateAICorrections, generateAIHint, generateAIQuiz } from './lib/quiz'
import { useAuth } from './auth-context'
import { AIActionError } from './lib/ai'
import { CreditModal, type CreditPrompt } from './components/CreditModal'
import { ThemeControl } from './theme'
import { usePreferences } from './preferences-context'
import { FlashcardsView } from './components/FlashcardsView'
import { flashcardDeckById } from './data/flashcards'
import { generateDeck, listGeneratedDecks, reportGeneratedDeck, unlockDeck, type GenerateDeckInput } from './lib/generatedFlashcards'
import { GenerateDeckModal } from './components/GenerateDeckModal'
import { VoiceDock } from './components/VoiceDock'
import { saveFlashcardReview, syncFlashcardProgress } from './lib/flashcardSync'

const navItems: { id: ViewId; label: string; icon: typeof Search }[] = [
  { id: 'explore', label: 'Explore', icon: Search },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'lab', label: 'Lab', icon: FlaskConical },
]

const greeting: ChatItem = {
  id: 'mentor-welcome',
  role: 'mentor',
  text: 'Click a structure to explore it with me, open Library for assessments, or enter Lab for guided dissection.',
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
  return <section className="model-detail brief-only panel anim2"><span className="eyebrow">Study brief</span><h2>{hotspot?.label || model.metadata.focus}</h2><p>{hotspot?.detail || model.description}</p></section>
}

export default function App() {
  const { user, balance, setBalance } = useAuth()
  const { reducedMotion } = usePreferences()
  const [persisted, setPersisted] = useState<PersistedState>(loadInitialState)
  const initialModel = modelById(persisted.selectedModelId)
  const initialHotspot = initialModel.hotspots.find((hotspot) => hotspot.id === persisted.selectedHotspotIds[initialModel.id])
  const initialDissection = persisted.dissectionByModel[initialModel.id]
  const [view, setView] = useState<ViewId>('explore')
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
  const [libraryMode, setLibraryMode] = useState<'catalog' | 'assessment' | 'flashcards'>('catalog')
  const [activeDeckId, setActiveDeckId] = useState<string>()
  const [generatedDecks, setGeneratedDecks] = useState<GeneratedDeckSummary[]>([])
  const [generateModel, setGenerateModel] = useState<ModelEntry>()
  const [generatingDeck, setGeneratingDeck] = useState(false)
  const [deckError, setDeckError] = useState<string>()
  const [labMode, setLabMode] = useState<'catalog' | 'manual' | 'guided'>('catalog')
  const [activeActivityId, setActiveActivityId] = useState<string>()
  const [guidedActivityStep, setGuidedActivityStep] = useState<number | null>(null)
  const [activityQuizChoice, setActivityQuizChoice] = useState<number>()
  const [activityQuizPassed, setActivityQuizPassed] = useState<boolean>()
  const [typing, setTyping] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mentorOpen, setMentorOpen] = useState(false)
  const [creditPrompt, setCreditPrompt] = useState<CreditPrompt>()
  const model = modelById(persisted.selectedModelId)
  const messages = persisted.chatByModel[model.id] ?? [greeting]
  const fallbackQuizzes = useMemo(() => quizzesForModel(model.id, quizSeed), [model.id, quizSeed])
  const modelQuizzes = generatedQuizSet?.modelId === model.id ? generatedQuizSet.quizzes : fallbackQuizzes
  const savedVariantId = persisted.selectedVariantIds[model.id]
  const selectedVariantId = model.variants.some((variant) => variant.id === savedVariantId) ? savedVariantId! : model.variants[0].id
  const favorite = persisted.favoriteModelIds.includes(model.id)
  const quizIds = new Set(allQuizzes.map((item) => item.id))
  const completedCount = new Set(persisted.completedQuizIds.filter((id) => quizIds.has(id))).size
  const activityCount = allQuizzes.length
  const completion = Math.round((completedCount / activityCount) * 100)
  const sideModels = anatomyModels
  const effectiveSidebarCollapsed = sidebarCollapsed || (view === 'lab' && labMode !== 'catalog')
  const mentorAvailable = view === 'explore' || (view === 'lab' && labMode !== 'catalog')
  const voiceAvailable = mentorAvailable || (view === 'library' && libraryMode === 'assessment')

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
    const progress = await syncFlashcardProgress(persisted.flashcardProgressByDeck)
    setPersisted((current) => ({ ...current, flashcardProgressByDeck: progress }))
  })

  useEffect(() => {
    if (!user) return
    const timer = window.setTimeout(() => void syncSignedInProgress().catch(() => undefined), 0)
    return () => window.clearTimeout(timer)
  }, [user])

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
    setMenuOpen(false)
  }

  function inspectModel(next: ModelEntry) {
    selectModel(next)
    setView('explore')
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
    const completesGuidedSelection = view === 'lab' && labMode === 'guided' && activeStep?.kind === 'action' && activeStep.action === 'select'
      && (!activeStep.targetIds || activeStep.targetIds.includes(hotspot.id))
      && (!activeStep.targetTerms || activeStep.targetTerms.every((term) => hotspot.label.toLowerCase().includes(term)))
    if (completesGuidedSelection && guidedActivityStep !== null) {
      setGuidedActivityStep(guidedActivityStep + 1)
      setActivityQuizChoice(undefined)
      setActivityQuizPassed(undefined)
    }
    if (multi || !explain) return
    const contextMessage: ChatItem = { id: crypto.randomUUID(), role: 'engine', text: `SELECTED · ${hotspot.label}`, status: 'neutral' }
    const authoredContext = `${hotspot.detail}${hotspot.conditions?.[0] ? ` A related study topic is ${hotspot.conditions[0].label}.` : ''}`
    setMessages((current) => [...current, contextMessage, { id: crypto.randomUUID(), role: 'mentor', text: `Authored context · ${authoredContext}` }])
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
    const stepComplete = Boolean(activeStep?.kind === 'action'
      && activeStep.action === context.action
      && (!activeStep.targetIds || activeStep.targetIds.every((id) => context.structureIds.includes(id)))
      && (!activeStep.targetTerms || activeStep.targetTerms.every((term) => context.structures.some((structure) => structure.toLowerCase().includes(term)))))
    if (stepComplete && activeStep?.kind === 'action' && guidedActivityStep !== null) {
      context = { ...context, guidedStep: activeStep.prompt }
      setGuidedActivityStep(guidedActivityStep + 1)
      setActivityQuizChoice(undefined)
      setActivityQuizPassed(undefined)
    }
    const target = context.structures.join(', ') || `the ${model.name.toLowerCase()} model`
    const completed = Boolean(context.guidedStep)
    const fallback = context.structures.some((structure) => structure.toLowerCase().includes('stomach')) && context.action === 'hide'
      ? 'Hiding the stomach exposes the pancreas, which lies posterior to it across much of the upper abdomen.'
      : context.structures.some((structure) => structure.toLowerCase().includes('pancreas')) && context.action === 'isolate'
        ? 'The pancreatic head sits within the curve of the duodenum, while the body extends behind the stomach toward the spleen.'
        : context.structures.some((structure) => structure.toLowerCase().includes('duodenum'))
          ? 'The duodenum receives pancreatic enzymes and bicarbonate through the pancreatic duct, supporting chemical digestion and neutralizing gastric acid.'
          : `You ${context.action} ${target}. Compare its position with the remaining visible digestive structures.`
    setMessages((current) => [...current, {
      id: crypto.randomUUID(),
      role: 'engine',
      text: `${completed ? 'STEP COMPLETE' : 'DISSECTION'} · ${context.action.toUpperCase()} · ${target}`,
      status: completed ? 'pass' : 'neutral',
    }])
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'mentor', text: `Authored context · ${fallback}` }])
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
    if (loadingHintIndex !== undefined || assessmentHints[index]) return
    if (!user) {
      window.location.assign(`/login?next=${encodeURIComponent(`/app?model=${model.id}`)}`)
      return
    }
    setLoadingHintIndex(index)
    setQuizGenerationError(undefined)
    setQuizNeedsCredits(false)
    try {
      const result = await generateAIHint(model, modelQuizzes[index])
      setBalance(result.balance)
      setAssessmentHints((current) => ({ ...current, [index]: result.hint }))
    } catch (error) {
      if (error instanceof AIActionError && error.balance) setBalance(error.balance)
      if (error instanceof AIActionError && error.code === 'insufficient_credits') setCreditPrompt({ action: 'An assessment hint', required: 1 })
      setQuizNeedsCredits(error instanceof AIActionError && error.code === 'insufficient_credits')
      setQuizGenerationError(error instanceof Error ? error.message : 'The hint could not be generated. No credit was charged.')
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

  function launchManualLab(modelId: string) {
    const nextModel = modelById(modelId)
    const segmented = nextModel.variants.find((variant) => variant.segmentedSystem)
    setPersisted((current) => ({
      ...current,
      selectedModelId: nextModel.id,
      selectedVariantIds: segmented ? { ...current.selectedVariantIds, [nextModel.id]: segmented.id } : current.selectedVariantIds,
    }))
    setSelectedIds([])
    setSelectedHotspot(undefined)
    setActiveActivityId(undefined)
    setGuidedActivityStep(null)
    setActivityQuizChoice(undefined)
    setActivityQuizPassed(undefined)
    setLabMode('manual')
    setView('lab')
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
    setPersisted((current) => {
      const existing = current.flashcardProgressByDeck[deck.id]
      const previous = existing?.cards[cardId]
      const updatedAt = new Date().toISOString()
      const reviewCount = (previous?.reviewCount ?? 0) + 1
      void saveFlashcardReview(deck.id, cardId, grade, reviewCount, updatedAt)
      return {
        ...current,
        flashcardProgressByDeck: {
          ...current.flashcardProgressByDeck,
          [deck.id]: {
            contentVersion: deck.contentVersion,
            cards: {
              ...(existing?.cards ?? {}),
              [cardId]: { grade, reviewCount, updatedAt },
            },
          },
        },
      }
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
      if (error instanceof AIActionError && error.code === 'insufficient_credits') setCreditPrompt({ action: 'A new 12-card flashcard deck', required: 5 })
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

  function handleSpokenAssessment(text: string) {
    if (voiceMode !== 'assessment' || assessmentSubmitted) return
    const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
    if (normalized.includes('next question')) { chooseQuiz(Math.min(modelQuizzes.length - 1, quizIndex + 1)); return }
    if (normalized.includes('previous question')) { chooseQuiz(Math.max(0, quizIndex - 1)); return }
    const letter = normalized.match(/^(?:answer |option )?([a-d])$/)?.[1]
    const exactOption = modelQuizzes[quizIndex]?.options.findIndex((option) => option.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim() === normalized)
    const choice = letter ? letter.charCodeAt(0) - 97 : exactOption
    if (choice !== undefined && choice >= 0 && choice < 4) setQuizAnswers((current) => ({ ...current, [quizIndex]: choice }))
  }

  const viewer = <AnatomyViewer key={`${model.id}:${view === 'lab' ? `${labMode}:${activeActivityId || ''}` : 'explore'}`} model={model} selectedIds={selectedIds} selectedHotspot={selectedHotspot} settings={persisted.settings} selectedVariantId={selectedVariantId} favorite={favorite} onSelect={selectHotspot} onSettings={(settings) => updatePersisted({ settings })} onVariant={selectVariant} onFavorite={() => toggleFavorite(model.id)} onDissectionAction={explainDissectionAction} dissectionSession={persisted.dissectionByModel[model.id]} onDissectionState={saveDissectionSession} initialDissect={view === 'lab' && labMode !== 'catalog'} activityLayout={view === 'lab' && labMode !== 'catalog'} guidedStep={guidedActivityStep} onGuidedStep={setGuidedActivityStep} />
  const quizView = <QuizzesView model={model} quizzes={modelQuizzes} quizIndex={quizIndex} answers={quizAnswers} submitted={assessmentSubmitted} hints={assessmentHints} corrections={assessmentCorrections} loadingHintIndex={loadingHintIndex} loadingCorrections={loadingCorrections} onQuiz={chooseQuiz} onAnswer={(index) => setQuizAnswers((current) => ({ ...current, [quizIndex]: index }))} onSubmit={submitAssessment} onHint={requestAssessmentHint} onNewAssessment={takeNewAIQuiz} onCorrections={requestAssessmentCorrections} generatingAssessment={generatingQuiz} aiError={quizGenerationError} aiNeedsCredits={quizNeedsCredits} signedIn={Boolean(user)} creditBalance={balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : undefined} onBack={() => setLibraryMode('catalog')} />
  const generatedActiveDeck = generatedDecks.find((deck) => deck.id === activeDeckId && deck.cards)
  const activeDeck = activeDeckId ? flashcardDeckById(activeDeckId) ?? (generatedActiveDeck?.cards ? { ...generatedActiveDeck, cards: generatedActiveDeck.cards } : undefined) : undefined
  const voiceMode = view === 'lab' ? 'lab' as const : view === 'library' ? 'assessment' as const : 'mentor' as const
  const voiceContext = (() => {
    const activeActivity = anatomyActivities.find((activity) => activity.id === activeActivityId)
    const step = guidedActivityStep === null ? undefined : activeActivity?.steps[guidedActivityStep]
    return {
      model: { id: model.id, name: model.name, variantId: selectedVariantId, system: model.system, facts: model.facts.slice(0, 5) },
      selectedStructure: selectedHotspot ? { id: selectedHotspot.id, label: selectedHotspot.label, detail: selectedHotspot.detail } : null,
      recentActions: (persisted.dissectionActionsByModel[model.id] ?? []).slice(-10).map(({ action, structureIds, structures }) => ({ action, structureIds, structures })),
      lab: voiceMode === 'lab' ? { activityId: activeActivityId, stepIndex: guidedActivityStep, prompt: step?.prompt } : undefined,
      assessment: voiceMode === 'assessment' ? { questionId: modelQuizzes[quizIndex]?.id, index: quizIndex, count: modelQuizzes.length, question: modelQuizzes[quizIndex]?.question, options: modelQuizzes[quizIndex]?.options, selectedIndex: quizAnswers[quizIndex] ?? null, submitted: assessmentSubmitted } : undefined,
    }
  })()
  const detail = <ModelDetail model={model} hotspot={selectedHotspot} />

  function renderCenter() {
    if (view === 'library') {
      if (libraryMode === 'assessment') return quizView
      if (libraryMode === 'flashcards' && activeDeck) return <FlashcardsView deck={activeDeck} progress={persisted.flashcardProgressByDeck[activeDeck.id]} onGrade={gradeFlashcard} onBack={() => setLibraryMode('catalog')} />
      return <LibraryView onOpen={inspectModel} onAssessment={openAssessment} onFlashcards={openFlashcards} onGenerate={(next) => { if (!user) window.location.assign('/login?next=/app'); else { setGenerateModel(next); setDeckError(undefined) } }} onGeneratedDeck={openGeneratedDeck} onUnlockDeck={unlockGeneratedDeck} onReportDeck={reportDeck} generatedDecks={generatedDecks} generatedError={deckError} favorites={persisted.favoriteModelIds} onFavorite={toggleFavorite} completedQuizIds={persisted.completedQuizIds} flashcardProgressByDeck={persisted.flashcardProgressByDeck} currentModelId={model.id} />
    }
    if (view === 'lab') {
      const lab = <DissectionActivitiesView mode={labMode} activeActivityId={activeActivityId} modelId={model.id} onGuided={launchDissectionActivity} onManual={launchManualLab} onCatalog={returnToLabCatalog} guidedStep={guidedActivityStep} quizChoice={activityQuizChoice} quizPassed={activityQuizPassed} onStartGuide={() => { setGuidedActivityStep(0); setActivityQuizChoice(undefined); setActivityQuizPassed(undefined) }} onQuizChoice={(choice) => { setActivityQuizChoice(choice); setActivityQuizPassed(undefined) }} onQuizCheck={checkActivityQuestion} onStepContinue={continueActivity} />
      return labMode === 'catalog' ? lab : <div className="lesson-workspace activity-workspace">{viewer}<div className="activity-pane">{lab}</div></div>
    }
    return <div className="explore-view">{viewer}{detail}</div>
  }

  return <div className={`app-shell ${effectiveSidebarCollapsed ? 'sidebar-collapsed' : ''} ${!mentorAvailable ? 'mentor-hidden' : ''}`}>
    <header className="mobile-head"><Brand /><button onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button></header>
    <aside className={`sidebar ${menuOpen ? 'open' : ''} ${effectiveSidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="side-brand"><Brand /><button onClick={() => setSidebarCollapsed((value) => !value)} aria-label={effectiveSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}>{effectiveSidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
      <nav>{navItems.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => chooseView(item.id)} aria-current={view === item.id ? 'page' : undefined} title={effectiveSidebarCollapsed ? item.label : undefined}><item.icon size={18} /><span>{item.label}</span>{item.id === 'library' && persisted.favoriteModelIds.length > 0 && <b>{persisted.favoriteModelIds.length}</b>}</button>)}</nav>
      <div className="side-section"><header><span>Anatomy models</span><button onClick={() => chooseView('library')}>All {models.length}</button></header><div className="model-list">{sideModels.map((entry) => <button key={entry.id} className={entry.id === model.id ? 'active' : ''} onClick={() => selectModel(entry)}><i /><span>{entry.name}</span>{persisted.favoriteModelIds.includes(entry.id) && <Star size={11} fill="currentColor" />}<ChevronRight size={14} /></button>)}</div></div>
      <div className="progress-card"><div><span>Quiz progress</span><b>{completion}%</b></div><i><b style={{ width: `${completion}%` }} /></i><small>{completedCount} of {activityCount} questions completed</small></div>
    </aside>
    <main className="workspace">
      <header className="topbar"><div><span>{view}</span><ChevronRight size={13} /><b>{model.name}</b></div><div className="top-actions"><ThemeControl compact /><a href="/account"><CircleUserRound size={16} />Account</a>{view !== 'lab' && <button onClick={() => chooseView('lab')}><FlaskConical size={16} />Open Lab</button>}</div></header>
      <div className="center-pane">{renderCenter()}</div>
    </main>
    {mentorAvailable && <MentorPanel model={model} selectedHotspot={selectedHotspot} actionHistory={persisted.dissectionActionsByModel[model.id] ?? []} messages={messages} typing={typing} onMessages={setMessages} onTyping={setTyping} mobileOpen={mentorOpen} onMobileClose={() => setMentorOpen(false)} onInsufficientCredits={() => setCreditPrompt({ action: 'An AI Mentor response', required: 1 })} />}
    <nav className="mobile-tabs" aria-label="Workspace navigation">{navItems.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => chooseView(item.id)} aria-current={view === item.id ? 'page' : undefined}><item.icon size={18} /><span>{item.label}</span></button>)}</nav>
    {mentorAvailable && <button className="mobile-mentor-button" onClick={() => setMentorOpen(true)} aria-expanded={mentorOpen} aria-controls="stranerd-mentor"><Bot size={15} />Mentor{typing && <i />}</button>}
    {voiceAvailable && <VoiceDock mode={voiceMode} modelId={model.id} context={voiceContext} onStudentCaption={handleSpokenAssessment} onInsufficientCredits={() => setCreditPrompt({ action: 'A five-minute Voice session', required: 10 })} />}
    <CreditModal prompt={creditPrompt} balance={balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : 0} onClose={() => setCreditPrompt(undefined)} />
    {generateModel && <GenerateDeckModal model={generateModel} balance={balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : 0} generating={generatingDeck} error={deckError} onClose={() => setGenerateModel(undefined)} onGenerate={createGeneratedDeck} />}
  </div>
}

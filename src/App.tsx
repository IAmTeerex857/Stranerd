import { lazy, Suspense, useEffect, useEffectEvent, useRef, useState, type FormEvent, type ReactNode, type SetStateAction } from 'react'
import { ArrowLeft, BookOpen, Bot, ChevronRight, CircleUserRound, Compass, Layers3, Menu, Microscope, Moon, PanelLeftClose, PanelLeftOpen, Search, Sparkles, Star, Sun, X } from 'lucide-react'
import { MentorPanel } from './components/MentorPanel'
import { anatomyModels, modelById, models } from './data/models'
import { loadState, saveState } from './lib/storage'
import type { ChatItem, FlashcardDeck, FlashcardGrade, GeneratedDeckSummary, Hotspot, MaterialReleaseProgress, ModelEntry, PersistedState, Quiz, ViewId } from './types'
import type { DissectionActionContext } from './data/dissection'
import { activityActionMatches, getBuiltInFlashcardDeck, getLabActivity, gradeLabQuestion, type LabActivity } from './lib/labActivities'
import { generateAICorrections, generateAIHint, generateAIQuiz } from './lib/quiz'
import { useAuth } from './auth-context'
import { AIActionError } from './lib/ai'
import type { CreditPrompt } from './components/CreditModal'
import { usePreferences } from './preferences-context'
import { builtInFlashcardMetadata } from './data/flashcardCatalog'
import { generateDeck, listGeneratedDecks, reportGeneratedDeck, unlockDeck, type GenerateDeckInput } from './lib/generatedFlashcards'
import { hydrateFlashcardProgress, mergeFlashcardProgress, syncFlashcardProgress } from './lib/flashcardSync'
import { Button } from '@/components/ui/button'
import { anatomyLayers } from './data/anatomyGraph'
import type { AnatomyViewerController, ViewerVoiceState } from './components/AnatomyViewer'
import type { FlashcardsController, FlashcardVoiceState } from './components/FlashcardsView'
import type { VoiceAction, VoiceActionResult, VoiceMode } from './lib/voiceActions'
import type { ActiveNoteContext, LibraryContentMode, MaterialCatalogController, MaterialCatalogState, MaterialLearningController, MaterialLearningState, MaterialSubject, NoteSelectionRequest } from './types/materials'
import { useTheme } from './theme-context'
import { currentMaterialReleaseIds, hydrateMaterialProgress, mergeMaterialProgress, reconcileDirtyMaterialReleaseIds, selectDirtyMaterialProgress, syncMaterialProgress } from './lib/materialProgressSync'
import { loginPath } from './auth-utils'
import { getModelAssessment, gradeModelAssessment } from './lib/assessments'
import { loadDesktopMentorOpen, loadSidebarCollapsed, saveDesktopMentorOpen, saveSidebarCollapsed } from './lib/workspaceChrome'
import { userAvatar, userFirstName } from './lib/userProfile'
import { createCoalescingRunner, type CoalescingRunner } from './lib/coalescingRunner'
import { useVoiceCore } from './lib/useVoiceCore'
import type { StudioController, StudioVoiceState } from './components/LibraryStudio'
import { useBodyScrollLock } from './lib/bodyScrollLock'
import { findMaterialCatalogDeck } from './lib/materialCatalog'

const logoUrl = '/branding/stranerd-wordmark.png'
const iconUrl = '/branding/stranerd-icon.png'
const CHAT_STORAGE_KEY = 'stranerd.chat.sessions.v1'
const workspaceParams = ['view', 'model', 'subject', 'content', 'mode', 'deck', 'activity', 'search'] as const

function workspaceUrl(view: ViewId, additions: Record<string, string | undefined> = {}) {
  const url = new URL(window.location.href)
  workspaceParams.forEach((key) => url.searchParams.delete(key))
  if (view !== 'explore') url.searchParams.set('view', view)
  Object.entries(additions).forEach(([key, value]) => { if (value) url.searchParams.set(key, value) })
  return url
}

const LibraryView = lazy(() => import('./components/WorkspaceViews').then((module) => ({ default: module.LibraryView })))
const QuizzesView = lazy(() => import('./components/WorkspaceViews').then((module) => ({ default: module.QuizzesView })))
const AnatomyViewer = lazy(() => import('./components/AnatomyViewer').then((module) => ({ default: module.AnatomyViewer })))
const DissectionActivitiesView = lazy(() => import('./components/DissectionActivitiesView').then((module) => ({ default: module.DissectionActivitiesView })))
const FlashcardsView = lazy(() => import('./components/FlashcardsView').then((module) => ({ default: module.FlashcardsView })))
const CreditModal = lazy(() => import('./components/CreditModal').then((module) => ({ default: module.CreditModal })))
const GenerateDeckModal = lazy(() => import('./components/GenerateDeckModal').then((module) => ({ default: module.GenerateDeckModal })))
const SearchResultsView = lazy(() => import('./components/SearchResultsView').then((module) => ({ default: module.SearchResultsView })))
const LibraryStudio = lazy(() => import('./components/LibraryStudio'))

function ViewLoading() {
  return <div className="view-loading" aria-label="Loading view"><span /><span /><span /></div>
}

const navItems: { id: ViewId; label: string; icon: typeof Search }[] = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'library', label: 'Learn', icon: BookOpen },
  { id: 'studio', label: 'Library', icon: Layers3 },
  { id: 'lab', label: 'Lab', icon: Microscope },
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

function loadChatSessions(storageKey: string): Record<string, ChatItem[]> {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(storageKey) ?? '{}') as Record<string, ChatItem[]>
    return Object.fromEntries(Object.entries(parsed).filter(([, messages]) => Array.isArray(messages)).map(([key, messages]) => [key, messages.slice(-100)]))
  } catch {
    return {}
  }
}

function Brand() {
  return <div className="brand"><img className="brand-full" src={logoUrl} alt="Stranerd" /><img className="brand-icon" src={iconUrl} alt="" /><span>Interactive anatomy</span></div>
}

function VoiceLayer({ mode, modelId, context, onAction, onInsufficientCredits, children }: { mode: VoiceMode; modelId: string; context: unknown; onAction: (action: VoiceAction) => VoiceActionResult | Promise<VoiceActionResult>; onInsufficientCredits: () => void; children: (voice: ReturnType<typeof useVoiceCore>) => ReactNode }) {
  const voice = useVoiceCore({ mode, modelId, context, onAction, onInsufficientCredits })
  return children(voice)
}

export default function App() {
  const { user, loading: authLoading, balance, setBalance } = useAuth()
  const { reducedMotion } = usePreferences()
  const { resolvedTheme, setPreference } = useTheme()
  const requestedDeckId = new URLSearchParams(window.location.search).get('deck') ?? undefined
  const requestedDeckIdRef = useRef(requestedDeckId)
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
  const [assessmentReviewing, setAssessmentReviewing] = useState(false)
  const [loadingHintIndex, setLoadingHintIndex] = useState<number>()
  const [loadingCorrections, setLoadingCorrections] = useState(false)
  const [quizSeed, setQuizSeed] = useState(loadAssessmentSeed)
  const [generatedQuizSet, setGeneratedQuizSet] = useState<{ modelId: string; quizzes: Quiz[] }>()
  const [authoredQuizSet, setAuthoredQuizSet] = useState<{ modelId: string; seed: number; quizzes: Quiz[] }>()
  const [generatingQuiz, setGeneratingQuiz] = useState(false)
  const [quizGenerationError, setQuizGenerationError] = useState<string>()
  const [quizNeedsCredits, setQuizNeedsCredits] = useState(false)
  const [libraryMode, setLibraryMode] = useState<'catalog' | 'assessment' | 'flashcards'>(() => requestedDeckId && builtInFlashcardMetadata(requestedDeckId) ? 'flashcards' : requestedLibraryMode === 'assessment' ? 'assessment' : 'catalog')
  const [activeDeckId, setActiveDeckId] = useState<string | undefined>(() => requestedDeckId && builtInFlashcardMetadata(requestedDeckId) ? requestedDeckId : undefined)
  const [builtInDeck, setBuiltInDeck] = useState<FlashcardDeck>()
  const [generatedDecks, setGeneratedDecks] = useState<GeneratedDeckSummary[]>([])
  const [generateModel, setGenerateModel] = useState<ModelEntry>()
  const [generatingDeck, setGeneratingDeck] = useState(false)
  const [deckError, setDeckError] = useState<string>()
  const [flashcardSyncError, setFlashcardSyncError] = useState(false)
  const [materialSyncError, setMaterialSyncError] = useState(false)
  const [flashcardSyncRetry, setFlashcardSyncRetry] = useState(0)
  const [labMode, setLabMode] = useState<'catalog' | 'guided'>('catalog')
  const [activeActivityId, setActiveActivityId] = useState<string>()
  const [activeActivity, setActiveActivity] = useState<LabActivity>()
  const [activityError, setActivityError] = useState<string>()
  const [guidedActivityStep, setGuidedActivityStep] = useState<number | null>(null)
  const [activityQuizChoice, setActivityQuizChoice] = useState<number>()
  const [activityQuizPassed, setActivityQuizPassed] = useState<boolean>()
  const [activityQuizExplanation, setActivityQuizExplanation] = useState<string>()
  const [typing, setTyping] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed)
  const initialSearch = new URLSearchParams(window.location.search).get('search') ?? ''
  const [workspaceSearch, setWorkspaceSearch] = useState(initialSearch)
  const [activeSearch, setActiveSearch] = useState(initialSearch.trim())
  const [mentorOpen, setMentorOpen] = useState(false)
  const [desktopMentorOpen, setDesktopMentorOpen] = useState(loadDesktopMentorOpen)
  const [creditPrompt, setCreditPrompt] = useState<CreditPrompt>()
  const [viewerVoiceState, setViewerVoiceState] = useState<ViewerVoiceState>()
  const [flashcardVoiceState, setFlashcardVoiceState] = useState<FlashcardVoiceState>()
  const [libraryContentMode, setLibraryContentMode] = useState<LibraryContentMode>(() => { const content = new URLSearchParams(window.location.search).get('content'); return content === 'practice' || content === 'tests' ? 'practice' : content === 'flashcards' ? 'flashcards' : 'notes' })
  const [activeNoteContext, setActiveNoteContext] = useState<ActiveNoteContext>()
  const [noteMentorRequest, setNoteMentorRequest] = useState<NoteSelectionRequest>()
  const [materialLearningState, setMaterialLearningState] = useState<MaterialLearningState>()
  const [materialCatalogState, setMaterialCatalogState] = useState<MaterialCatalogState>()
  const [studioVoiceState, setStudioVoiceState] = useState<StudioVoiceState>()
  const [workspaceRevision, setWorkspaceRevision] = useState(0)
  const viewerController = useRef<AnatomyViewerController>(null)
  const flashcardsController = useRef<FlashcardsController>(null)
  const materialLearningController = useRef<MaterialLearningController | undefined>(undefined)
  const materialCatalogController = useRef<MaterialCatalogController | undefined>(undefined)
  const studioController = useRef<StudioController | undefined>(undefined)
  const generatedDecksRef = useRef<GeneratedDeckSummary[]>([])
  const flashcardHydratedUser = useRef<string | undefined>(undefined)
  const materialHydratedUser = useRef<string | undefined>(undefined)
  const observedPendingReviewIds = useRef<Set<string>>(new Set())
  const observedMaterialDirtyVersions = useRef<Map<string, string>>(new Map())
  const model = modelById(persisted.selectedModelId)
  const materialSession = materialLearningState?.target === 'material-flashcards' ? materialLearningState.deckId : materialLearningState?.subject
  const chatSessionKey = view === 'explore'
    ? `explore:${model.id}`
    : view === 'lab'
      ? `lab:${labMode}:${activeActivityId ?? 'catalog'}`
      : view === 'studio'
        ? `studio:${studioVoiceState?.target ?? 'catalog'}`
      : libraryMode === 'assessment'
        ? `library:assessment:${model.id}`
        : libraryMode === 'flashcards'
          ? `library:flashcards:${activeDeckId ?? 'catalog'}`
          : `library:${libraryContentMode}:${activeNoteContext?.sectionId ?? materialSession ?? 'catalog'}`
  const chatStorageKey = `${CHAT_STORAGE_KEY}:${user?.id ?? 'guest'}`
  const [chatSessions, setChatSessions] = useState<Record<string, ChatItem[]>>(() => loadChatSessions(chatStorageKey))
  const chatStorageKeyRef = useRef(chatStorageKey)
  const messages = chatSessions[chatSessionKey] ?? [greeting]
  const modelQuizzes = generatedQuizSet?.modelId === model.id ? generatedQuizSet.quizzes : authoredQuizSet?.modelId === model.id && authoredQuizSet.seed === quizSeed ? authoredQuizSet.quizzes : []
  const savedVariantId = persisted.selectedVariantIds[model.id]
  const selectedVariantId = model.variants.some((variant) => variant.id === savedVariantId) ? savedVariantId! : model.variants[0].id
  const favorite = persisted.favoriteModelIds.includes(model.id)
  const sideModels = anatomyModels
  const assistantAvailable = true
  const pendingFlashcardReviewKey = persisted.pendingFlashcardReviews.map((review) => review.id).join(':')
  const materialDirtyKey = persisted.materialProgressDirtyReleaseIds.map((releaseId) => `${releaseId}:${JSON.stringify(persisted.materialProgressByRelease[releaseId])}`).join(':')
  const creditBalance = balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : 0
  const requestedProtectedContent = (() => {
    const params = new URLSearchParams(window.location.search)
    return params.has('subject') || params.has('deck') || params.get('mode') === 'assessment' || params.has('activity')
  })()
  useEffect(() => { generatedDecksRef.current = generatedDecks }, [generatedDecks])
  useEffect(() => saveSidebarCollapsed(sidebarCollapsed), [sidebarCollapsed])
  useEffect(() => saveDesktopMentorOpen(desktopMentorOpen), [desktopMentorOpen])

  useEffect(() => {
    if (!authLoading && !user && requestedProtectedContent) window.location.replace(loginPath())
  }, [authLoading, requestedProtectedContent, user])

  useEffect(() => {
    saveState(persisted)
  }, [persisted])

  useEffect(() => {
    const timer = window.setTimeout(() => setWorkspaceRevision((revision) => revision + 1), 0)
    return () => window.clearTimeout(timer)
  }, [activeActivityId, activeDeckId, activeNoteContext?.sectionId, activeSearch, guidedActivityStep, labMode, libraryContentMode, libraryMode, materialCatalogState?.activeReleaseId, materialLearningState?.target, model.id, quizIndex, view])

  useEffect(() => {
    const restoreUrl = () => {
      const params = new URLSearchParams(window.location.search)
      const requested = params.get('view')
      const next = params.has('subject') ? 'library' : navItems.some((item) => item.id === requested) ? requested as ViewId : 'explore'
      setView(next)
      setActiveSearch(params.get('search')?.trim() ?? '')
      setWorkspaceSearch(params.get('search') ?? '')
      const content = params.get('content')
      setLibraryContentMode(content === 'practice' || content === 'tests' ? 'practice' : content === 'flashcards' ? 'flashcards' : 'notes')
      const deck = params.get('deck') ?? undefined
      const deckAvailable = Boolean(deck && (builtInFlashcardMetadata(deck) || generatedDecksRef.current.some((entry) => entry.id === deck && entry.cards)))
      setActiveDeckId(deckAvailable ? deck : undefined)
      setLibraryMode(deckAvailable ? 'flashcards' : params.get('mode') === 'assessment' ? 'assessment' : 'catalog')
      setQuizIndex(0)
      setQuizAnswers({})
      setAssessmentSubmitted(false)
      setAssessmentHints({})
      setAssessmentCorrections(undefined)
      setAssessmentReviewing(false)
      const modelId = params.get('model')
      if (modelId && models.some((entry) => entry.id === modelId)) {
        setPersisted((current) => ({ ...current, selectedModelId: modelId }))
        setSelectedIds([])
        setSelectedHotspot(undefined)
      }
      if (next !== 'library') { setActiveNoteContext(undefined); setMaterialLearningState(undefined); materialLearningController.current = undefined }
    }
    window.addEventListener('popstate', restoreUrl)
    return () => window.removeEventListener('popstate', restoreUrl)
  }, [])

  useEffect(() => {
    if (chatStorageKeyRef.current !== chatStorageKey) {
      chatStorageKeyRef.current = chatStorageKey
      setChatSessions(loadChatSessions(chatStorageKey))
      return
    }
    window.sessionStorage.setItem(chatStorageKey, JSON.stringify(chatSessions))
  }, [chatSessions, chatStorageKey])

  useEffect(() => {
    if (!user) return
    let active = true
    void listGeneratedDecks().then((decks) => {
      if (!active) return
      setGeneratedDecks(decks)
      const requested = requestedDeckIdRef.current ? decks.find((deck) => deck.id === requestedDeckIdRef.current && deck.cards) : undefined
      if (requested) {
        setActiveDeckId(requested.id)
        setLibraryMode('flashcards')
      }
    }).catch(() => { if (active) setGeneratedDecks([]) })
    return () => { active = false }
  }, [user])

  useEffect(() => {
    if (!user || !activeDeckId || !builtInFlashcardMetadata(activeDeckId) || builtInDeck?.id === activeDeckId) return
    let active = true
    void getBuiltInFlashcardDeck(activeDeckId).then(({ deck }) => {
      if (active) setBuiltInDeck(deck)
    }).catch((error) => { if (active) setDeckError(error instanceof Error ? error.message : 'The flashcard deck could not be loaded.') })
    return () => { active = false }
  }, [activeDeckId, builtInDeck?.id, user])

  useEffect(() => {
    if (!user || view !== 'library' || libraryMode !== 'assessment' || generatedQuizSet?.modelId === model.id) return
    let active = true
    void getModelAssessment(model.id, quizSeed).then(({ quizzes }) => {
      if (active) setAuthoredQuizSet({ modelId: model.id, seed: quizSeed, quizzes })
    }).catch((error) => { if (active) setQuizGenerationError(error instanceof Error ? error.message : 'The assessment could not be loaded.') })
    return () => { active = false }
  }, [generatedQuizSet?.modelId, libraryMode, model.id, quizSeed, user, view])

  const flashcardSyncRunner = useRef<CoalescingRunner | null>(null)
  const materialSyncRunner = useRef<CoalescingRunner | null>(null)

  const runFlashcardSync = useEffectEvent(async () => {
    if (!user) return
    try {
      if (flashcardHydratedUser.current !== user.id) {
        const rows = await hydrateFlashcardProgress()
        setPersisted((current) => ({ ...current, flashcardProgressByDeck: mergeFlashcardProgress(current.flashcardProgressByDeck, rows) }))
        flashcardHydratedUser.current = user.id
      }
      const pending = persisted.pendingFlashcardReviews
      if (pending.length === 0) {
        setFlashcardSyncError(false)
        return
      }
      const result = await syncFlashcardProgress(pending, persisted.flashcardProgressByDeck)
      const completed = new Set([...result.acknowledgedIds, ...result.rejectedIds])
      if (completed.size > 0 || result.rows.length > 0) {
        setPersisted((current) => ({
          ...current,
          flashcardProgressByDeck: mergeFlashcardProgress(current.flashcardProgressByDeck, result.rows),
          pendingFlashcardReviews: current.pendingFlashcardReviews.filter((review) => !completed.has(review.id)),
        }))
      }
      setFlashcardSyncError(result.failed)
    } catch (error) {
      console.error('Flashcard progress hydration failed', error)
      setFlashcardSyncError(true)
      throw new Error('Flashcard progress sync failed.', { cause: error })
    }
  })

  const runMaterialSync = useEffectEvent(async () => {
    if (!user) return
    try {
      const ownerChanged = Boolean(persisted.materialProgressOwnerId && persisted.materialProgressOwnerId !== user.id)
      if (materialHydratedUser.current !== user.id) {
        const canMergeLocal = !persisted.materialProgressOwnerId || persisted.materialProgressOwnerId === user.id
        const [remote, compatibleLocalReleaseIds] = await Promise.all([
          hydrateMaterialProgress(),
          canMergeLocal ? currentMaterialReleaseIds(persisted.materialProgressByRelease) : Promise.resolve([]),
        ])
        setPersisted((current) => ({
          ...current,
          materialProgressByRelease: current.materialProgressOwnerId && current.materialProgressOwnerId !== user.id ? remote : mergeMaterialProgress(current.materialProgressByRelease, remote),
          materialProgressDirtyReleaseIds: current.materialProgressOwnerId && current.materialProgressOwnerId !== user.id ? [] : reconcileDirtyMaterialReleaseIds(compatibleLocalReleaseIds),
          materialProgressOwnerId: user.id,
        }))
        materialHydratedUser.current = user.id
        setMaterialSyncError(false)
        window.setTimeout(() => void materialSyncRunner.current?.request().catch(() => undefined), 0)
        return
      }
      if (ownerChanged) {
        setMaterialSyncError(false)
        return
      }
      const dirty = selectDirtyMaterialProgress(persisted.materialProgressByRelease, persisted.materialProgressDirtyReleaseIds)
      if (Object.keys(dirty).length === 0) {
        setMaterialSyncError(false)
        return
      }
      const result = await syncMaterialProgress(dirty)
      const acknowledged = new Set(result.acknowledgedReleaseIds)
      if (acknowledged.size > 0 || Object.keys(result.progress).length > 0) {
        setPersisted((current) => ({
          ...current,
          materialProgressByRelease: mergeMaterialProgress(current.materialProgressByRelease, result.progress),
          materialProgressDirtyReleaseIds: current.materialProgressDirtyReleaseIds.filter((releaseId) => {
            if (!acknowledged.has(releaseId)) return true
            const sent = dirty[releaseId]
            const latest = current.materialProgressByRelease[releaseId]
            return !sent || !latest || JSON.stringify(sent) !== JSON.stringify(latest)
          }),
          materialProgressOwnerId: user.id,
        }))
      }
      setMaterialSyncError(result.failed)
    } catch {
      setMaterialSyncError(true)
      throw new Error('Material progress sync failed.')
    }
  })

  useEffect(() => {
    const flashcards = createCoalescingRunner(runFlashcardSync)
    const materials = createCoalescingRunner(runMaterialSync, 250)
    flashcardSyncRunner.current = flashcards
    materialSyncRunner.current = materials
    return () => {
      flashcards.dispose()
      materials.dispose()
      flashcardSyncRunner.current = null
      materialSyncRunner.current = null
    }
  }, [])

  useEffect(() => {
    if (!user) return
    void flashcardSyncRunner.current?.request().catch(() => undefined)
    void materialSyncRunner.current?.request().catch(() => undefined)
  }, [user])

  useEffect(() => {
    const ids = new Set(persisted.pendingFlashcardReviews.map((review) => review.id))
    const hasNewReview = [...ids].some((id) => !observedPendingReviewIds.current.has(id))
    observedPendingReviewIds.current = ids
    if (user && hasNewReview) void flashcardSyncRunner.current?.request().catch(() => undefined)
  }, [pendingFlashcardReviewKey, persisted.pendingFlashcardReviews, user])

  useEffect(() => {
    const versions = new Map(persisted.materialProgressDirtyReleaseIds.map((releaseId) => [releaseId, JSON.stringify(persisted.materialProgressByRelease[releaseId])]))
    const hasNewVersion = [...versions].some(([releaseId, version]) => observedMaterialDirtyVersions.current.get(releaseId) !== version)
    observedMaterialDirtyVersions.current = versions
    if (user && hasNewVersion) void materialSyncRunner.current?.request().catch(() => undefined)
  }, [materialDirtyKey, persisted.materialProgressByRelease, persisted.materialProgressDirtyReleaseIds, user])

  useEffect(() => {
    if (!user || flashcardSyncRetry === 0) return
    void flashcardSyncRunner.current?.request().catch(() => undefined)
    void materialSyncRunner.current?.request().catch(() => undefined)
  }, [flashcardSyncRetry, user])

  useEffect(() => {
    const retry = () => {
      void flashcardSyncRunner.current?.request().catch(() => undefined)
      void materialSyncRunner.current?.request().catch(() => undefined)
    }
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])

  useBodyScrollLock(menuOpen && window.innerWidth < 1200)

  function updatePersisted(next: Partial<PersistedState>) {
    setPersisted((current) => ({ ...current, ...next }))
  }

  function setMessages(action: SetStateAction<ChatItem[]>) {
    setChatSessions((current) => {
      const currentMessages = current[chatSessionKey] ?? [greeting]
      const nextMessages = typeof action === 'function' ? action(currentMessages) : action
      return { ...current, [chatSessionKey]: nextMessages.slice(-100) }
    })
  }

  function updateMaterialProgress(subject: MaterialSubject, patch: Partial<MaterialReleaseProgress>) {
    setPersisted((current) => {
      const previous = current.materialProgressByRelease[subject.releaseId]
      const base = previous?.contentVersion === subject.contentVersion ? previous : { contentVersion: subject.contentVersion, readSectionIds: [], practiceAnswers: {}, practiceSubmitted: false, updatedAt: new Date(0).toISOString() }
      return {
        ...current,
        materialProgressByRelease: { ...current.materialProgressByRelease, [subject.releaseId]: { ...base, ...patch, contentVersion: subject.contentVersion, updatedAt: new Date().toISOString() } },
        materialProgressDirtyReleaseIds: [...new Set([...current.materialProgressDirtyReleaseIds, subject.releaseId])].sort(),
      }
    })
  }

  function requireAuth(next = `${window.location.pathname}${window.location.search}${window.location.hash}`) {
    if (user) return true
    if (!authLoading) window.location.assign(loginPath(next))
    return false
  }

  function closeWorkspaceSearch() {
    setActiveSearch('')
    const url = new URL(window.location.href)
    url.searchParams.delete('search')
    window.history.replaceState({}, '', url)
  }

  function selectModel(next: ModelEntry, updateHistory = true) {
    closeWorkspaceSearch()
    updatePersisted({ selectedModelId: next.id })
    const restoredHotspot = next.hotspots.find((hotspot) => hotspot.id === persisted.selectedHotspotIds[next.id])
    const restoredDissection = persisted.dissectionByModel[next.id]
    setSelectedIds(restoredDissection?.active ? restoredDissection.selectedIds : restoredHotspot ? [restoredHotspot.id] : [])
    setSelectedHotspot(restoredHotspot)
    setQuizIndex(0)
    resetAssessment()
    setGeneratedQuizSet(undefined)
    setActiveActivityId(undefined)
    setActiveActivity(undefined)
    setLabMode('catalog')
    setGuidedActivityStep(null)
    setLibraryMode('catalog')
    setActiveNoteContext(undefined)
    setMaterialLearningState(undefined)
    materialLearningController.current = undefined
    setView('explore')
    setMenuOpen(false)
    if (updateHistory) window.history.pushState({}, '', workspaceUrl('explore', { model: next.id }))
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
    const currentActivity = activeActivity && activeActivity.id === activeActivityId && activeActivity.modelId === model.id ? activeActivity : undefined
    const activeStep = guidedActivityStep === null ? undefined : currentActivity?.steps[guidedActivityStep]
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
    const currentActivity = activeActivity && activeActivity.id === activeActivityId && activeActivity.modelId === model.id ? activeActivity : undefined
    const activeStep = guidedActivityStep === null ? undefined : currentActivity?.steps[guidedActivityStep]
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
  }

  function chooseView(next: ViewId) {
    setActiveSearch('')
    setWorkspaceSearch('')
    setView(next)
    window.history.pushState({}, '', workspaceUrl(next))
    if (next === 'library') {
      setLibraryMode('catalog')
      setActiveNoteContext(undefined)
      setMaterialLearningState(undefined)
      materialLearningController.current = undefined
      setMentorOpen(false)
    }
    if (next !== 'library') {
      setActiveNoteContext(undefined)
      setMaterialLearningState(undefined)
      materialLearningController.current = undefined
    }
    if (next === 'lab') {
      setLabMode('catalog')
      setActiveActivityId(undefined)
      setActiveActivity(undefined)
      setGuidedActivityStep(null)
    }
    setMenuOpen(false)
  }

  function submitWorkspaceSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = workspaceSearch.trim()
    if (!query) return
    setActiveSearch(query)
    setMentorOpen(false)
    const url = new URL(window.location.href)
    url.searchParams.set('search', query)
    window.history.replaceState({}, '', url)
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
    setAssessmentReviewing(false)
    setLoadingHintIndex(undefined)
    setLoadingCorrections(false)
    setQuizGenerationError(undefined)
    setQuizNeedsCredits(false)
  }

  async function submitAssessment() {
    if (Object.keys(quizAnswers).length !== modelQuizzes.length) return
    let gradedQuizzes = modelQuizzes
    if (generatedQuizSet?.modelId !== model.id) {
      try {
        const result = await gradeModelAssessment(model.id, quizSeed, quizAnswers)
        gradedQuizzes = result.quizzes
        setAuthoredQuizSet({ modelId: model.id, seed: quizSeed, quizzes: gradedQuizzes })
      } catch (error) {
        setQuizGenerationError(error instanceof Error ? error.message : 'The assessment could not be graded.')
        return
      }
    }
    const passedIds = gradedQuizzes.filter((entry, index) => quizAnswers[index] === entry.correctIndex).map((entry) => entry.id)
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
    if (!assessmentSubmitted || loadingCorrections) return 'failure' as const
    if (assessmentCorrections) return 'success' as const
    if (!user) {
      window.location.assign(`/login?next=${encodeURIComponent(`/app?model=${model.id}`)}`)
      return 'failure' as const
    }
    setLoadingCorrections(true)
    setQuizGenerationError(undefined)
    setQuizNeedsCredits(false)
    try {
      const answers = modelQuizzes.map((_, index) => quizAnswers[index] ?? null)
      const result = await generateAICorrections(model, modelQuizzes, answers)
      setBalance(result.balance)
      setAssessmentCorrections(result.corrections)
      setAssessmentReviewing(true)
      return 'success' as const
    } catch (error) {
      if (error instanceof AIActionError && error.balance) setBalance(error.balance)
      if (error instanceof AIActionError && error.code === 'insufficient_credits') setCreditPrompt({ action: 'Detailed assessment corrections', required: 2 })
      setQuizNeedsCredits(error instanceof AIActionError && error.code === 'insufficient_credits')
      setQuizGenerationError(error instanceof Error ? error.message : 'Corrections could not be generated. No credit was charged.')
      return 'failure' as const
    } finally {
      setLoadingCorrections(false)
    }
  }

  async function launchDissectionActivity(activityId: string, updateHistory = true) {
    const destination = workspaceUrl('lab', { activity: activityId })
    if (!requireAuth(`${destination.pathname}${destination.search}${destination.hash}`)) return
    setActivityError(undefined)
    let activity: LabActivity
    try {
      activity = (await getLabActivity(activityId)).activity
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : 'This Lab could not be loaded.')
      return
    }
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
    setActivityQuizExplanation(undefined)
    setView('lab')
    if (updateHistory) window.history.pushState({}, '', destination)
    setActiveActivity(activity)
    resetAssessment()
    setGeneratedQuizSet(undefined)
  }

  const launchRequestedActivity = useEffectEvent((activityId: string) => launchDissectionActivity(activityId, false))

  useEffect(() => {
    if (authLoading || !user || activeActivityId) return
    const requested = new URLSearchParams(window.location.search).get('activity')
    if (!requested) return
    const timer = window.setTimeout(() => void launchRequestedActivity(requested), 0)
    return () => window.clearTimeout(timer)
  }, [activeActivityId, authLoading, user])

  function openAssessment(next: ModelEntry) {
    const destination = workspaceUrl('library', { mode: 'assessment', model: next.id })
    if (!requireAuth(`${destination.pathname}${destination.search}${destination.hash}`)) return
    selectModel(next, false)
    setLibraryMode('assessment')
    setView('library')
    window.history.pushState({}, '', destination)
  }

  function openFlashcards(deck: FlashcardDeck) {
    const destination = workspaceUrl('library', { deck: deck.id, model: deck.modelId })
    if (!requireAuth(`${destination.pathname}${destination.search}${destination.hash}`)) return
    selectModel(modelById(deck.modelId), false)
    setActiveDeckId(deck.id)
    setLibraryMode('flashcards')
    setView('library')
    window.history.pushState({}, '', destination)
  }

  function gradeFlashcard(cardId: string, grade: FlashcardGrade) {
    if (!activeDeckId) return
    const generated = generatedDecks.find((entry) => entry.id === activeDeckId && entry.cards)
    const deck = builtInDeck?.id === activeDeckId ? builtInDeck : generated?.cards ? { ...generated, cards: generated.cards } : undefined
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
    if (!subject || typeof subject.releaseId !== 'string' || !subject.releaseId || typeof subject.contentVersion !== 'string' || !subject.contentVersion || typeof cardId !== 'string' || !cardId || !['again', 'hard', 'good', 'easy'].includes(grade)) {
      console.error('Invalid material flashcard review was blocked.', { subject, cardId, grade })
      return
    }
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
      openGeneratedDeck(summary)
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
    selectModel(modelById(deck.modelId), false)
    setActiveDeckId(deck.id)
    setLibraryMode('flashcards')
    setView('library')
    window.history.pushState({}, '', workspaceUrl('library', { deck: deck.id, model: deck.modelId }))
  }

  function returnToLibraryCatalog() {
    setLibraryMode('catalog')
    setActiveDeckId(undefined)
    setAssessmentReviewing(false)
    window.history.pushState({}, '', workspaceUrl('library', { content: libraryContentMode }))
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
    setActivityQuizExplanation(undefined)
    setActiveActivity(undefined)
    window.history.pushState({}, '', workspaceUrl('lab'))
  }

  async function checkActivityQuestion() {
    const activity = activeActivity
    if (!activity || guidedActivityStep === null || activityQuizChoice === undefined) return
    try {
      const result = await gradeLabQuestion(activity.id, guidedActivityStep === activity.steps.length ? 'final' : guidedActivityStep, activityQuizChoice)
      setActivityQuizPassed(result.correct)
      setActivityQuizExplanation(result.explanation)
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : 'The Lab answer could not be checked.')
    }
  }

  function continueActivity() {
    if (!activityQuizPassed || guidedActivityStep === null) return
    setGuidedActivityStep(guidedActivityStep + 1)
    setActivityQuizChoice(undefined)
    setActivityQuizPassed(undefined)
    setActivityQuizExplanation(undefined)
  }

  async function handleVoiceAction(action: VoiceAction): Promise<VoiceActionResult> {
    if (action.type === 'library.openDeck') {
      if (action.expectedRevision !== undefined && action.expectedRevision !== workspaceRevision) return { ok: false, error: 'The workspace changed since that request. Ask again using the latest context.' }
      if (view !== 'library' || libraryMode !== 'catalog' || libraryContentMode !== 'flashcards') return { ok: false, error: 'Open the Learn flashcard catalog before choosing a deck.' }
      const deck = materialCatalogState && findMaterialCatalogDeck(materialCatalogState.decks, action.deckId)
      const controller = materialCatalogController.current
      if (!deck || !controller) return { ok: false, error: 'That published material flashcard deck is not listed in the current catalog.' }
      setMaterialLearningState(undefined)
      materialLearningController.current = undefined
      if (!await controller.openRelease(deck.releaseId)) return { ok: false, error: 'That published material flashcard deck is no longer available.' }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      return { ok: true, message: `${deck.title} flashcards opened.` }
    }
    if (action.type === 'library.openSet') {
      if (action.expectedRevision !== undefined && action.expectedRevision !== workspaceRevision) return { ok: false, error: 'The workspace changed since that request. Ask again using the latest context.' }
      if (view !== 'studio') return { ok: false, error: 'Open Studio before opening a generated set.' }
      if (studioVoiceState?.target !== 'studio-catalog' || !studioVoiceState.sets.some((set) => set.id === action.setId)) return { ok: false, error: 'That ready owned set is not listed in the current Studio catalog.' }
      return studioController.current?.openSet(action.setId) ?? { ok: false, error: 'Studio is still loading.' }
    }
    if (action.type === 'navigation.open' || action.type === 'navigation.back') {
      if (action.expectedRevision !== undefined && action.expectedRevision !== workspaceRevision) return { ok: false, error: 'The workspace changed since that request. Ask again using the latest context.' }
      const discardsState = (view === 'lab' && labMode === 'guided') || (view === 'library' && (libraryMode !== 'catalog' || Boolean(materialLearningState) || Boolean(materialCatalogState?.activeReleaseId))) || (view === 'studio' && studioVoiceState?.target !== 'studio-catalog')
      if (discardsState && !window.confirm('Leave the current learning activity and open the requested workspace?')) return { ok: false, error: 'The learner chose to keep the current activity open.' }
      if (action.type === 'navigation.back') {
        if (view === 'lab' && labMode === 'guided') returnToLabCatalog()
        else if (view === 'library' && libraryMode !== 'catalog') returnToLibraryCatalog()
        else if (view === 'library' && (activeNoteContext || materialLearningState || materialCatalogState?.activeReleaseId)) document.querySelector<HTMLButtonElement>('.subject-materials-header .library-back')?.click()
        else if (view === 'studio' && studioVoiceState?.target !== 'studio-catalog') document.querySelector<HTMLButtonElement>('.lr-study .library-back')?.click()
        else return { ok: false, error: 'There is no safe in-app back target.' }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        return { ok: true, message: 'Opened the previous workspace.' }
      }
      if (action.modelId) {
        if (action.destination !== 'explore') return { ok: false, error: 'An anatomy model can only be opened in Explore.' }
        const nextModel = models.find((entry) => entry.id === action.modelId)
        if (!nextModel) return { ok: false, error: `Unknown anatomy model: ${action.modelId}` }
        selectModel(nextModel)
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        return { ok: true, message: `${nextModel.name} opened in Explore.` }
      }
      if (action.destination === 'explore') chooseView('explore')
      if (action.destination === 'studio') chooseView('studio')
      if (action.destination === 'lab') chooseView('lab')
      if (action.destination.startsWith('learn_')) {
        chooseView('library')
        const content = action.destination === 'learn_notes' ? 'notes' : action.destination === 'learn_flashcards' ? 'flashcards' : 'practice'
        setLibraryContentMode(content)
        window.history.replaceState({}, '', workspaceUrl('library', { content }))
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      return { ok: true, message: `${action.destination.replace('_', ' ')} opened.` }
    }
    if (view === 'library' && libraryMode === 'catalog' && libraryContentMode === 'notes') return { ok: false, error: 'Notes are read-only and have no voice mutation actions.' }
    if (view === 'library' && libraryMode === 'catalog' && materialCatalogState?.activeReleaseId) {
      if (!materialLearningState) return { ok: false, error: 'The material flashcard controls are still loading.' }
      const controller = materialLearningController.current
      if (!controller || controller.target !== materialLearningState.target) return { ok: false, error: 'The material learning controls are still loading.' }
      if (materialLearningState.target === 'material-practice' && action.type.startsWith('assessment.')) return controller.executeVoiceAction(action as Extract<VoiceAction, { type: `assessment.${string}` }>)
      if (materialLearningState.target === 'material-flashcards' && (action.type.startsWith('flashcard.') || action.type === 'materialFlashcard.hint')) {
        return controller.executeVoiceAction(action as Extract<VoiceAction, { type: `flashcard.${string}` | `materialFlashcard.${string}` }>)
      }
      return { ok: false, error: 'That voice action does not apply to the open material.' }
    }
    if (action.type === 'materialFlashcard.hint') return { ok: false, error: 'Paid hints are available for imported material flashcards.' }
    if (view === 'studio' && studioVoiceState?.target !== 'studio-catalog') {
      if (action.type.startsWith('flashcard.') && studioVoiceState?.target === 'studio-flashcards') return studioController.current?.executeVoiceAction(action as Extract<VoiceAction, { type: `flashcard.${string}` }>) ?? { ok: false, error: 'Studio flashcards are still loading.' }
      if (action.type.startsWith('assessment.') && studioVoiceState?.target === 'studio-practice') return studioController.current?.executeVoiceAction(action as Extract<VoiceAction, { type: `assessment.${string}` }>) ?? { ok: false, error: 'Studio practice is still loading.' }
      return { ok: false, error: 'That voice action does not apply to the open Studio set.' }
    }
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
        const generated = await requestAssessmentHint(quizIndex)
        return generated ? { ok: true, message: 'The hint is now visible.' } : { ok: false, error: 'The hint could not be generated.' }
      }
      if (action.type === 'assessment.corrections') {
        if (!assessmentSubmitted) return { ok: false, error: 'Corrections are only available after submission.' }
        if (assessmentCorrections) return { ok: true, message: 'Corrections are already available.' }
        const result = await requestAssessmentCorrections()
        return result === 'success' ? { ok: true, message: 'Corrections are now visible.' } : { ok: false, error: 'Corrections could not be generated.' }
      }
      if (action.type === 'assessment.review') {
        if (!assessmentSubmitted) return { ok: false, error: 'Submit the assessment before reviewing answers.' }
        if (!assessmentCorrections) return { ok: false, error: 'Paid corrections must be unlocked before Nerd Bot can review assessment answers.' }
        setAssessmentReviewing(true)
        return { ok: true, message: 'Answer review opened.' }
      }
      if (assessmentSubmitted) return { ok: false, error: 'This assessment has already been submitted.' }
      if (Object.keys(quizAnswers).length !== modelQuizzes.length) return { ok: false, error: 'Answer every question before submitting.' }
      if (!window.confirm('Submit this assessment for final grading?')) return { ok: false, error: 'The learner did not confirm assessment submission.' }
      await submitAssessment()
      return { ok: true, message: 'Assessment submitted.' }
    }
    if (view !== 'library' || libraryMode !== 'flashcards') return { ok: false, error: 'A flashcard deck is not open.' }
    return flashcardsController.current?.executeVoiceAction(action as Extract<VoiceAction, { type: `flashcard.${string}` }>) ?? { ok: false, error: 'The flashcard is still loading.' }
  }

  const viewer = <AnatomyViewer ref={viewerController} key={`${model.id}:${view === 'lab' ? `${labMode}:${activeActivityId || ''}` : 'explore'}`} model={model} selectedIds={selectedIds} selectedHotspot={selectedHotspot} settings={persisted.settings} selectedVariantId={selectedVariantId} favorite={favorite} onSelect={selectHotspot} onClearSelection={clearSelection} onSettings={(settings) => updatePersisted({ settings })} onVariant={selectVariant} onFavorite={() => toggleFavorite(model.id)} onDissectionAction={explainDissectionAction} dissectionSession={persisted.dissectionByModel[model.id]} onDissectionState={saveDissectionSession} onVoiceState={setViewerVoiceState} initialDissect={view === 'lab' && labMode !== 'catalog'} activityLayout={view === 'lab' && labMode !== 'catalog'} guidedStep={guidedActivityStep} onGuidedStep={setGuidedActivityStep} />
  const quizView = <QuizzesView model={model} quizzes={modelQuizzes} quizIndex={quizIndex} answers={quizAnswers} submitted={assessmentSubmitted} hints={assessmentHints} corrections={assessmentCorrections} loadingHintIndex={loadingHintIndex} loadingCorrections={loadingCorrections} onQuiz={chooseQuiz} onAnswer={(index) => setQuizAnswers((current) => ({ ...current, [quizIndex]: index }))} onSubmit={submitAssessment} onHint={requestAssessmentHint} onNewAssessment={takeNewAIQuiz} onCorrections={requestAssessmentCorrections} onReviewing={setAssessmentReviewing} generatingAssessment={generatingQuiz} aiError={quizGenerationError} aiNeedsCredits={quizNeedsCredits} signedIn={Boolean(user)} creditBalance={balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : undefined} onBack={returnToLibraryCatalog} />
  const generatedActiveDeck = generatedDecks.find((deck) => deck.id === activeDeckId && deck.cards)
  const activeDeck = activeDeckId ? builtInDeck?.id === activeDeckId ? builtInDeck : generatedActiveDeck?.cards ? { ...generatedActiveDeck, cards: generatedActiveDeck.cards } : undefined : undefined
  const voiceMode: VoiceMode = activeSearch || (view === 'studio' && (!studioVoiceState || studioVoiceState.target === 'studio-catalog')) || (view === 'lab' && labMode === 'catalog') || (view === 'library' && libraryMode === 'catalog' && !materialLearningState && !activeNoteContext) ? 'app' : view === 'studio' ? studioVoiceState?.target === 'studio-flashcards' ? 'flashcard' : 'assessment' : view === 'lab' ? 'lab' : view === 'library' ? libraryMode === 'flashcards' || materialLearningState?.target === 'material-flashcards' ? 'flashcard' : libraryMode === 'assessment' || materialLearningState?.target === 'material-practice' ? 'assessment' : 'notes' : 'mentor'
  const voiceContext = (() => {
    if (voiceMode === 'app') return { screen: 'app', workspace: { view: activeSearch ? 'search' : view, section: activeSearch || (view === 'library' ? libraryContentMode : view === 'studio' ? 'studio' : view === 'lab' ? 'catalog' : undefined), revision: workspaceRevision, canGoBack: (view === 'lab' && labMode === 'guided') || (view === 'library' && (libraryMode !== 'catalog' || Boolean(activeNoteContext) || Boolean(materialLearningState) || Boolean(materialCatalogState?.activeReleaseId))) || (view === 'studio' && studioVoiceState?.target !== 'studio-catalog'), librarySets: view === 'studio' && studioVoiceState?.target === 'studio-catalog' ? studioVoiceState.sets : undefined, decks: view === 'library' && libraryMode === 'catalog' && libraryContentMode === 'flashcards' && !materialCatalogState?.activeReleaseId ? materialCatalogState?.decks.map(({ id, title }) => ({ id, title })) : undefined } }
    if (voiceMode === 'notes') return { screen: 'notes', revision: workspaceRevision, note: activeNoteContext }
    const step = guidedActivityStep === null ? undefined : activeActivity?.steps[guidedActivityStep]
    const common = {
      screen: voiceMode,
      revision: workspaceRevision,
      model: { id: model.id, name: model.name, variantId: selectedVariantId, variants: model.variants.map(({ id, label }) => ({ id, label })), system: model.system, facts: model.facts.slice(0, 5) },
      selectedStructure: selectedHotspot ? { id: selectedHotspot.id, label: selectedHotspot.label, detail: selectedHotspot.detail } : null,
      recentActions: (persisted.dissectionActionsByModel[model.id] ?? []).slice(-10).map(({ action, structureIds, structures }) => ({ action, structureIds, structures })),
    }
    const viewerContext = { settings: persisted.settings, layers: model.viewer === 'segmented-body' ? anatomyLayers.map(({ id, label }) => ({ id, label, visible: viewerVoiceState?.visibleLayerIds.includes(id) ?? false })) : [], state: viewerVoiceState ? { ...viewerVoiceState, structures: viewerVoiceState.structures.slice(0, 50) } : undefined }
    if (voiceMode === 'mentor') return { ...common, viewer: viewerContext }
    if (voiceMode === 'lab') return { ...common, viewer: viewerContext, lab: { activityId: activeActivityId, stepIndex: guidedActivityStep, prompt: step?.prompt, validated: activityQuizPassed } }
    if (voiceMode === 'assessment') return { ...common, assessment: view === 'studio' && studioVoiceState?.target === 'studio-practice' ? { questionId: studioVoiceState.questionId, index: studioVoiceState.index, count: studioVoiceState.count, question: studioVoiceState.question, options: studioVoiceState.options, selectedIndex: studioVoiceState.selectedIndex, submitted: studioVoiceState.submitted, phase: studioVoiceState.phase, score: studioVoiceState.score, correctAnswer: studioVoiceState.correctAnswer, explanation: studioVoiceState.explanation } : materialLearningState?.target === 'material-practice' ? { questionId: materialLearningState.questionId, index: materialLearningState.index, count: materialLearningState.count, question: materialLearningState.question, options: materialLearningState.options, selectedIndex: materialLearningState.selectedIndex, submitted: materialLearningState.submitted, hint: materialLearningState.hint, phase: materialLearningState.phase, score: materialLearningState.score, correctAnswer: materialLearningState.correctAnswer, explanation: materialLearningState.explanation } : { questionId: modelQuizzes[quizIndex]?.id, index: quizIndex, count: modelQuizzes.length, question: modelQuizzes[quizIndex]?.question, options: modelQuizzes[quizIndex]?.options, selectedIndex: quizAnswers[quizIndex] ?? null, submitted: assessmentSubmitted, hint: assessmentHints[quizIndex], phase: assessmentSubmitted ? assessmentCorrections && assessmentReviewing ? 'review' : 'result' : 'taking', score: assessmentSubmitted ? modelQuizzes.filter((entry, index) => quizAnswers[index] === entry.correctIndex).length : undefined, correctAnswer: assessmentSubmitted && assessmentReviewing && assessmentCorrections ? modelQuizzes[quizIndex]?.options[modelQuizzes[quizIndex]?.correctIndex] : undefined, explanation: assessmentSubmitted && assessmentReviewing ? assessmentCorrections?.[quizIndex] : undefined } }
    return { ...common, flashcard: view === 'studio' && studioVoiceState?.target === 'studio-flashcards' ? { deckId: studioVoiceState.deckId, cardId: studioVoiceState.cardId, index: studioVoiceState.index, count: studioVoiceState.count, side: studioVoiceState.side, graded: studioVoiceState.graded, question: studioVoiceState.question, answer: studioVoiceState.answer } : materialLearningState?.target === 'material-flashcards' ? { deckId: materialLearningState.deckId, cardId: materialLearningState.cardId, index: materialLearningState.index, count: materialLearningState.count, side: materialLearningState.side, graded: materialLearningState.graded, question: materialLearningState.question, answer: materialLearningState.answer, hint: materialLearningState.hint } : flashcardVoiceState }
  })()
  function renderCenter() {
    if (activeSearch) return <SearchResultsView key={activeSearch} query={activeSearch} materialProgressByRelease={persisted.materialProgressByRelease} progressByDeck={persisted.flashcardProgressByDeck} />
    if (view === 'library') {
      if (requestedProtectedContent && (!user || authLoading)) return <ViewLoading />
      if (libraryMode === 'assessment') return modelQuizzes.length ? quizView : <ViewLoading />
      if (libraryMode === 'flashcards' && activeDeck) return <FlashcardsView key={activeDeck.id} ref={flashcardsController} deck={activeDeck} progress={persisted.flashcardProgressByDeck[activeDeck.id]} onGrade={gradeFlashcard} onVoiceState={setFlashcardVoiceState} onBack={returnToLibraryCatalog} />
      return <LibraryView mode={libraryContentMode} onAssessment={openAssessment} onFlashcards={openFlashcards} onGeneratedDeck={openGeneratedDeck} onUnlockDeck={unlockGeneratedDeck} onReportDeck={reportDeck} onMaterialGrade={gradeMaterialFlashcard} onMaterialProgress={updateMaterialProgress} onModeChange={(mode) => { setLibraryContentMode(mode); if (mode !== 'notes') setActiveNoteContext(undefined) }} onNoteContext={setActiveNoteContext} onNoteRequest={(prompt) => { setNoteMentorRequest({ id: crypto.randomUUID(), prompt }); setMentorOpen(true) }} onMaterialLearningState={setMaterialLearningState} onMaterialLearningController={(controller) => { materialLearningController.current = controller }} onMaterialCatalog={(registration) => { materialCatalogController.current = registration?.controller; setMaterialCatalogState(registration?.state) }} onBalance={setBalance} onInsufficientCredits={(action, required) => setCreditPrompt({ action, required })} onSignIn={(next?: string) => { requireAuth(next) }} signedIn={Boolean(user)} creditBalance={balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : undefined} generatedDecks={generatedDecks} generatedError={deckError} completedQuizIds={persisted.completedQuizIds} flashcardProgressByDeck={persisted.flashcardProgressByDeck} materialProgressByRelease={persisted.materialProgressByRelease} />
    }
    if (view === 'studio') return <LibraryStudio onVoiceState={setStudioVoiceState} onController={(controller) => { studioController.current = controller }} />
    if (view === 'lab') {
      const lab = <DissectionActivitiesView mode={labMode} activeActivity={activeActivity} onGuided={(activityId) => void launchDissectionActivity(activityId)} onCatalog={returnToLabCatalog} guidedStep={guidedActivityStep} quizChoice={activityQuizChoice} quizPassed={activityQuizPassed} quizExplanation={activityQuizExplanation} onStartGuide={() => { setGuidedActivityStep(0); setActivityQuizChoice(undefined); setActivityQuizPassed(undefined); setActivityQuizExplanation(undefined) }} onQuizChoice={(choice) => { setActivityQuizChoice(choice); setActivityQuizPassed(undefined); setActivityQuizExplanation(undefined) }} onQuizCheck={() => void checkActivityQuestion()} onStepContinue={continueActivity} />
      if (activityError) return <div className="materials-state error" role="alert"><p>{activityError}</p><Button variant="outline" onClick={() => { setActivityError(undefined); returnToLabCatalog() }}>Back to Lab</Button></div>
      return labMode === 'catalog' ? lab : <div className="lesson-workspace activity-workspace lab-guided-workspace">{viewer}<div className="activity-pane">{lab}</div></div>
    }
    return <div className="explore-view"><div className="mobile-model-chips" aria-label="Choose anatomy model">{sideModels.map((entry) => <button key={entry.id} className={entry.id === model.id ? 'active' : ''} onClick={() => selectModel(entry)}><i />{entry.name}</button>)}</div>{viewer}</div>
  }

  const materialScreen = materialLearningState?.target
  const mobileNestedLibrary = view === 'library' && (libraryMode !== 'catalog' || Boolean(activeNoteContext) || Boolean(materialScreen))
  const mobileNestedStudio = view === 'studio' && studioVoiceState?.target !== 'studio-catalog'
  const mobileTitle = view === 'lab' && labMode === 'guided'
    ? activeActivity?.title ?? 'Lab'
    : view === 'library' && libraryMode === 'flashcards' && activeDeck
      ? `${activeDeck.title} flashcards`
      : view === 'library' && libraryMode === 'assessment'
        ? `${model.name} test`
        : view === 'library' && activeNoteContext
          ? `${activeNoteContext.subject} notes`
          : view === 'library' && materialScreen === 'material-flashcards'
            ? `${materialLearningState?.subject ?? 'Subject'} flashcards`
            : view === 'library' && materialScreen === 'material-practice'
              ? `${materialLearningState?.subject ?? 'Subject'} test`
              : view === 'library' ? 'Learn' : view === 'studio' ? 'Library' : view === 'lab' ? 'Lab' : model.name
  const mobileSubtitle = view === 'explore'
    ? `${model.system} · ${model.metadata.region}`
    : view === 'lab' && labMode === 'guided'
      ? `Step ${Math.min((guidedActivityStep ?? -1) + 1, activeActivity?.steps.length ?? 0)} of ${activeActivity?.steps.length ?? 0}`
      : view === 'library' && libraryMode === 'flashcards' && activeDeck
        ? `${flashcardVoiceState?.index !== undefined ? flashcardVoiceState.index + 1 : 1} of ${activeDeck.cards.length}`
        : view === 'library' && libraryMode === 'assessment'
          ? `${Object.keys(quizAnswers).length} of ${modelQuizzes.length} answered`
          : view === 'library' && activeNoteContext
            ? activeNoteContext.section
            : materialLearningState
              ? `${materialLearningState.index + 1} of ${materialLearningState.count}`
              : undefined
  function mobileBack() {
    if (view === 'lab' && labMode === 'guided') returnToLabCatalog()
    else if (view === 'library' && libraryMode !== 'catalog') returnToLibraryCatalog()
    else if (view === 'studio') document.querySelector<HTMLButtonElement>('.lr-study .library-back')?.click()
    else document.querySelector<HTMLButtonElement>('.subject-materials-header .library-back')?.click()
  }

  const firstName = userFirstName(user)
  const avatar = userAvatar(user)
  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${!desktopMentorOpen ? 'mentor-hidden' : ''}`}>
    <header className="mobile-head">
      <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen} aria-controls="app-sidebar">{menuOpen ? <X /> : <Menu />}</button>
      {(view === 'lab' && labMode === 'guided' || mobileNestedLibrary || mobileNestedStudio) && <button className="mobile-back" onClick={mobileBack} aria-label="Back"><ArrowLeft /></button>}
      <div className="mobile-context"><b>{mobileTitle}</b>{mobileSubtitle && <span>{mobileSubtitle}</span>}</div>
      <a className="mobile-credits" href="/account" aria-label={`${creditBalance} credits`}><Sparkles size={14} /><b>{creditBalance}</b></a>
      <button onClick={() => setPreference(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label={`Use ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}>{resolvedTheme === 'dark' ? <Sun /> : <Moon />}</button>
    </header>
    <aside id="app-sidebar" className={`sidebar ${menuOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="side-brand"><Brand /><button onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}>{sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
      <div className="mobile-drawer-brand"><img src={logoUrl} alt="Stranerd" /><button className="mobile-sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X size={20} /></button></div>
      <nav>{navItems.map((item) => <Button variant="ghost" key={item.id} className={`${item.id === 'studio' ? 'studio-nav ' : ''}${!activeSearch && view === item.id ? 'active' : ''}`} onClick={() => chooseView(item.id)} aria-current={!activeSearch && view === item.id ? 'page' : undefined}><item.icon size={18} /><span>{item.label}</span></Button>)}</nav>
      <div className="side-section"><header><span>Subjects</span><b>{sideModels.length}</b></header><div className="model-list">{sideModels.map((entry) => <Button variant="ghost" key={entry.id} className={entry.id === model.id ? 'active' : ''} onClick={() => selectModel(entry)}><i /><span>{entry.name}</span><small>{entry.system}</small>{persisted.favoriteModelIds.includes(entry.id) && <Star size={11} fill="currentColor" />}</Button>)}</div></div>
      <Button variant="ghost" className="sidebar-account" asChild><a href="/account">{avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <span className="sidebar-account-avatar">{firstName[0]?.toUpperCase()}</span>}<span><b>{firstName}</b><small>{creditBalance} credits</small></span><ChevronRight size={14} /></a></Button>
    </aside>
    {menuOpen && <button className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
    <main className="workspace">
      <header className="topbar">
        <div><span>{activeSearch ? 'Search' : view === 'library' ? 'Learn' : view === 'studio' ? 'Library' : view === 'lab' ? 'Lab' : 'Explore'}</span>{!activeSearch && (view === 'explore' || labMode === 'guided') && <><ChevronRight size={13} /><b>{view === 'lab' ? mobileTitle : model.name}</b></>}</div>
        <form className="workspace-search" role="search" onSubmit={submitWorkspaceSearch}><Search size={16} /><input value={workspaceSearch} onChange={(event) => setWorkspaceSearch(event.target.value)} placeholder="Search subjects, notes, tests…" aria-label="Search workspace" /></form>
        <div className="top-actions">{flashcardSyncError && <Button variant="outline" role="alert" onClick={() => setFlashcardSyncRetry((value) => value + 1)}>Flashcard progress not synced · Retry</Button>}{materialSyncError && <Button variant="outline" role="alert" onClick={() => setFlashcardSyncRetry((value) => value + 1)}>Learn progress not synced · Retry</Button>}{!desktopMentorOpen && <><a className="credit-pill" href="/account"><Sparkles size={15} /><b>{creditBalance}</b><span>credits</span></a><Button variant="outline" size="icon" onClick={() => setPreference(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label={`Use ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}>{resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</Button></>}</div>
      </header>
      <div className="center-pane"><Suspense fallback={<ViewLoading />}>{renderCenter()}</Suspense></div>
    </main>
    {assistantAvailable && desktopMentorOpen && <div className="mentor-top-actions"><a className="credit-pill" href="/account"><Sparkles size={15} /><b>{creditBalance}</b><span>credits</span></a><Button variant="outline" size="icon" onClick={() => setPreference(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label={`Use ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`}>{resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</Button></div>}
    <nav className="mobile-tabs" aria-label="Workspace navigation">{navItems.map((item) => <Button variant="ghost" key={item.id} className={view === item.id ? 'active' : ''} onClick={() => chooseView(item.id)} aria-current={view === item.id ? 'page' : undefined}><item.icon size={21} /><span>{item.label}</span></Button>)}<Button variant="ghost" asChild><a href="/account"><CircleUserRound size={21} /><span>Account</span></a></Button></nav>
    {assistantAvailable && <VoiceLayer mode={voiceMode} modelId={model.id} context={voiceContext} onAction={handleVoiceAction} onInsufficientCredits={() => setCreditPrompt({ action: 'A five-minute Voice session', required: 10 })}>{(voice) => <><MentorPanel model={model} selectedHotspot={selectedHotspot} actionHistory={persisted.dissectionActionsByModel[model.id] ?? []} messages={messages} typing={typing} onMessages={setMessages} onTyping={setTyping} mobileOpen={mentorOpen} onMobileClose={() => setMentorOpen(false)} onDesktopClose={() => setDesktopMentorOpen(false)} onInsufficientCredits={() => setCreditPrompt({ action: 'A Nerd Bot response', required: 1 })} noteContext={activeNoteContext} draftRequest={noteMentorRequest} voice={voice} /><aside className={`mentor-rail voice-${voice.muted ? 'muted' : voice.status ?? 'idle'}`} aria-label="Collapsed Nerd Bot"><button onClick={() => setDesktopMentorOpen(true)} aria-label={`Open Nerd Bot${voice.status ? `, Voice ${voice.muted ? 'muted' : voice.status}` : ''}`} aria-controls="stranerd-mentor"><Bot size={21} />{(typing || voice.status && !['ended', 'error'].includes(voice.status)) && <i />}</button></aside><button className={`mobile-mentor-button voice-${voice.muted ? 'muted' : voice.status ?? 'idle'}`} onClick={() => setMentorOpen(true)} aria-label={`Open Nerd Bot${voice.status ? `, Voice ${voice.muted ? 'muted' : voice.status}` : ''}`} aria-expanded={mentorOpen} aria-controls="stranerd-mentor" data-voice-active={voice.status && !['ended', 'error'].includes(voice.status) ? 'true' : undefined}><Bot size={25} />{(typing || voice.status && !['ended', 'error'].includes(voice.status)) && <i />}</button></>}</VoiceLayer>}
    {creditPrompt && <Suspense fallback={null}><CreditModal prompt={creditPrompt} balance={balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : 0} onClose={() => setCreditPrompt(undefined)} /></Suspense>}
    {generateModel && <Suspense fallback={null}><GenerateDeckModal model={generateModel} balance={balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : 0} generating={generatingDeck} error={deckError} onClose={() => setGenerateModel(undefined)} onGenerate={createGeneratedDeck} /></Suspense>}
  </div>
}

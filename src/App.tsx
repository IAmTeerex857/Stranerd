import { useEffect, useLayoutEffect, useMemo, useState, type SetStateAction } from 'react'
import { BookOpen, Bot, ChevronRight, CircleUserRound, ClipboardList, Library, Menu, Moon, Network, NotebookPen, PanelLeftClose, PanelLeftOpen, Search, Star, Sun, X } from 'lucide-react'
import { AnatomyViewer } from './components/AnatomyViewer'
import { MentorPanel } from './components/MentorPanel'
import { LibraryView, NotesView, QuizzesView, SystemsView } from './components/WorkspaceViews'
import { anatomyModels, modelById, models } from './data/models'
import logoUrl from '../Logo Stranerd.png'
import iconUrl from '../Icon Logo Stranerd.png'
import { allQuizzes, evaluateQuiz, quizzesForModel } from './data/quizzes'
import { loadState, saveState } from './lib/storage'
import type { ChatItem, Evaluation, Hotspot, ModelEntry, PersistedState, Quiz, ViewId } from './types'
import type { DissectionActionContext } from './data/dissection'
import { DissectionActivitiesView } from './components/DissectionActivitiesView'
import { anatomyActivities, type AnatomyActivity } from './data/activities'
import { digestiveDissectionQuiz } from './data/dissection'
import { generateAIQuiz } from './lib/quiz'
import { useAuth } from './auth-context'
import { AIActionError } from './lib/ai'

const navItems: { id: ViewId; label: string; icon: typeof Search }[] = [
  { id: 'explore', label: 'Explore', icon: Search },
  { id: 'systems', label: 'Systems', icon: Network },
  { id: 'lessons', label: 'Activities', icon: BookOpen },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
]

const greeting: ChatItem = {
  id: 'mentor-welcome',
  role: 'mentor',
  text: 'Click a structure to explore it with me, or open Activities for quizzes and guided dissection.',
}

type Theme = 'dark' | 'light'

function loadTheme(): Theme {
  return window.localStorage.getItem('stranerd.theme') === 'light' ? 'light' : 'dark'
}

function loadInitialState() {
  const state = loadState()
  const requestedModel = new URLSearchParams(window.location.search).get('model')
  return requestedModel && models.some((entry) => entry.id === requestedModel) ? { ...state, selectedModelId: requestedModel } : state
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
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [persisted, setPersisted] = useState<PersistedState>(loadInitialState)
  const initialModel = modelById(persisted.selectedModelId)
  const initialHotspot = initialModel.hotspots.find((hotspot) => hotspot.id === persisted.selectedHotspotIds[initialModel.id])
  const [view, setView] = useState<ViewId>('explore')
  const [selectedIds, setSelectedIds] = useState<string[]>(initialHotspot ? [initialHotspot.id] : [])
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | undefined>(initialHotspot)
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizChoice, setQuizChoice] = useState<number>()
  const [quizResult, setQuizResult] = useState<Evaluation>()
  const [quizSeed, setQuizSeed] = useState(() => crypto.getRandomValues(new Uint32Array(1))[0])
  const [generatedQuizSet, setGeneratedQuizSet] = useState<{ modelId: string; quizzes: Quiz[] }>()
  const [generatingQuiz, setGeneratingQuiz] = useState(false)
  const [quizGenerationError, setQuizGenerationError] = useState<string>()
  const [quizNeedsCredits, setQuizNeedsCredits] = useState(false)
  const [activityMode, setActivityMode] = useState<'quiz' | 'dissection'>('quiz')
  const [activeActivityId, setActiveActivityId] = useState<string>()
  const [guidedActivityStep, setGuidedActivityStep] = useState<number | null>(null)
  const [activityQuizChoice, setActivityQuizChoice] = useState<number>()
  const [activityQuizPassed, setActivityQuizPassed] = useState<boolean>()
  const [typing, setTyping] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mentorOpen, setMentorOpen] = useState(false)
  const model = modelById(persisted.selectedModelId)
  const messages = persisted.chatByModel[model.id] ?? [greeting]
  const fallbackQuizzes = useMemo(() => quizzesForModel(model.id, quizSeed), [model.id, quizSeed])
  const modelQuizzes = generatedQuizSet?.modelId === model.id ? generatedQuizSet.quizzes : fallbackQuizzes
  const quiz = modelQuizzes[quizIndex] ?? modelQuizzes[0]
  const savedVariantId = persisted.selectedVariantIds[model.id]
  const selectedVariantId = model.variants.some((variant) => variant.id === savedVariantId) ? savedVariantId! : model.variants[0].id
  const favorite = persisted.favoriteModelIds.includes(model.id)
  const quizIds = new Set(allQuizzes.map((item) => item.id))
  const completedCount = new Set(persisted.completedQuizIds.filter((id) => quizIds.has(id))).size
  const activityCount = allQuizzes.length
  const completion = Math.round((completedCount / activityCount) * 100)
  const sideModels = anatomyModels
  const effectiveSidebarCollapsed = sidebarCollapsed || view === 'lessons'

  useEffect(() => {
    saveState(persisted)
  }, [persisted])

  useEffect(() => {
    if (!menuOpen || window.innerWidth > 760) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [menuOpen])

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('stranerd.theme', theme)
  }, [theme])

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
    setSelectedIds(restoredHotspot ? [restoredHotspot.id] : [])
    setSelectedHotspot(restoredHotspot)
    setQuizIndex(0)
    setQuizChoice(undefined)
    setQuizResult(undefined)
    setGeneratedQuizSet(undefined)
    setActiveActivityId(undefined)
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
    if (multi || !explain) return
    const contextMessage: ChatItem = { id: crypto.randomUUID(), role: 'engine', text: `SELECTED · ${hotspot.label}`, status: 'neutral' }
    const authoredContext = `${hotspot.detail}${hotspot.conditions?.[0] ? ` A related study topic is ${hotspot.conditions[0].label}.` : ''}`
    setMessages((current) => [...current, contextMessage, { id: crypto.randomUUID(), role: 'mentor', text: `Authored context · ${authoredContext}` }])
  }

  function explainDissectionAction(context: DissectionActionContext) {
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
    setMenuOpen(false)
  }

  function toggleFavorite(modelId: string) {
    const exists = persisted.favoriteModelIds.includes(modelId)
    updatePersisted({ favoriteModelIds: exists ? persisted.favoriteModelIds.filter((id) => id !== modelId) : [...persisted.favoriteModelIds, modelId] })
  }

  function inspectBookmark(nextModel: ModelEntry, hotspot: Hotspot) {
    updatePersisted({ selectedModelId: nextModel.id, selectedHotspotIds: { ...persisted.selectedHotspotIds, [nextModel.id]: hotspot.id } })
    setQuizChoice(undefined)
    setQuizResult(undefined)
    setSelectedIds([hotspot.id])
    setSelectedHotspot(hotspot)
    setMenuOpen(false)
    setView('explore')
  }

  async function evaluateKnowledgeQuiz() {
    const result = evaluateQuiz(quiz, quizChoice)
    setQuizResult(result)
    if (result.pass && !persisted.completedQuizIds.includes(quiz.id)) updatePersisted({ completedQuizIds: [...persisted.completedQuizIds, quiz.id] })
  }

  function chooseQuiz(index: number) {
    setQuizIndex(index)
    setQuizChoice(undefined)
    setQuizResult(undefined)
  }

  function restartQuiz() {
    setQuizIndex(0)
    setQuizChoice(undefined)
    setQuizResult(undefined)
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
      restartQuiz()
    } catch (error) {
      if (error instanceof AIActionError && error.balance) setBalance(error.balance)
      setQuizNeedsCredits(error instanceof AIActionError && error.code === 'insufficient_credits')
      setQuizGenerationError(error instanceof Error ? error.message : 'The AI quiz could not be generated. No credit was charged.')
    } finally {
      setGeneratingQuiz(false)
    }
  }

  function launchDissectionActivity(activity?: AnatomyActivity) {
    if (!activity) {
      setActiveActivityId(undefined)
      setGuidedActivityStep(null)
      return
    }
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
    setGuidedActivityStep(null)
    setActivityQuizChoice(undefined)
    setActivityQuizPassed(undefined)
    setActivityMode('dissection')
    setQuizChoice(undefined)
    setQuizResult(undefined)
    setGeneratedQuizSet(undefined)
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

  const viewer = <AnatomyViewer key={`${model.id}:${view === 'lessons' ? `${activityMode}:${activeActivityId || ''}` : 'explore'}`} model={model} selectedIds={selectedIds} selectedHotspot={selectedHotspot} settings={persisted.settings} selectedVariantId={selectedVariantId} favorite={favorite} onSelect={selectHotspot} onSettings={(settings) => updatePersisted({ settings })} onVariant={selectVariant} onFavorite={() => toggleFavorite(model.id)} onDissectionAction={explainDissectionAction} initialDissect={view === 'lessons' && activityMode === 'dissection' && Boolean(activeActivityId)} activityLayout={view === 'lessons'} guidedStep={guidedActivityStep} onGuidedStep={setGuidedActivityStep} />
  const quizView = <QuizzesView model={model} quizzes={modelQuizzes} quizIndex={quizIndex} quizChoice={quizChoice} result={quizResult} completed={persisted.completedQuizIds} onQuiz={chooseQuiz} onQuizChoice={(index) => { setQuizChoice(index); setQuizResult(undefined) }} onQuizEvaluate={evaluateKnowledgeQuiz} onRestart={restartQuiz} onNewQuiz={takeNewAIQuiz} generatingQuiz={generatingQuiz} aiError={quizGenerationError} aiNeedsCredits={quizNeedsCredits} signedIn={Boolean(user)} creditBalance={balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : undefined} />
  const detail = <ModelDetail model={model} hotspot={selectedHotspot} />

  function renderCenter() {
    if (view === 'systems') return <SystemsView onOpen={inspectModel} />
    if (view === 'library') return <LibraryView onOpen={inspectModel} favorites={persisted.favoriteModelIds} onFavorite={toggleFavorite} />
    if (view === 'notes') return <NotesView notes={persisted.notes} model={model} hotspotId={selectedHotspot?.id} bookmarks={persisted.bookmarkedHotspotRefs} onNotes={(notes) => updatePersisted({ notes })} onRemoveBookmark={(ref) => updatePersisted({ bookmarkedHotspotRefs: persisted.bookmarkedHotspotRefs.filter((item) => item !== ref) })} onInspectBookmark={inspectBookmark} />
    if (view === 'lessons') return <div className="lesson-workspace activity-workspace">{viewer}<div className="activity-pane"><nav className="activity-tabs"><button className={activityMode === 'quiz' ? 'active' : ''} onClick={() => setActivityMode('quiz')}>Quick quiz</button><button className={activityMode === 'dissection' ? 'active' : ''} onClick={() => setActivityMode('dissection')}>Dissection labs</button></nav>{activityMode === 'quiz' ? quizView : <DissectionActivitiesView activeActivityId={activeActivityId} modelId={model.id} onLaunch={launchDissectionActivity} guidedStep={guidedActivityStep} quizChoice={activityQuizChoice} quizPassed={activityQuizPassed} onStartGuide={() => { setGuidedActivityStep(0); setActivityQuizChoice(undefined); setActivityQuizPassed(undefined) }} onQuizChoice={(choice) => { setActivityQuizChoice(choice); setActivityQuizPassed(undefined) }} onQuizCheck={checkActivityQuestion} onStepContinue={continueActivity} />}</div></div>
    return <div className="explore-view">{viewer}{detail}</div>
  }

  return <div className={`app-shell ${effectiveSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <header className="mobile-head"><Brand /><button onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button></header>
    <aside className={`sidebar ${menuOpen ? 'open' : ''} ${effectiveSidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="side-brand"><Brand /><button onClick={() => setSidebarCollapsed((value) => !value)} aria-label={effectiveSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}>{effectiveSidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
      <nav>{navItems.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => chooseView(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.id === 'library' && persisted.favoriteModelIds.length > 0 && <b>{persisted.favoriteModelIds.length}</b>}{item.id === 'notes' && persisted.notes.length + persisted.bookmarkedHotspotRefs.length > 0 && <b>{persisted.notes.length + persisted.bookmarkedHotspotRefs.length}</b>}</button>)}</nav>
      <div className="side-section"><header><span>Anatomy models</span><button onClick={() => chooseView('library')}>All {models.length}</button></header><div className="model-list">{sideModels.map((entry) => <button key={entry.id} className={entry.id === model.id ? 'active' : ''} onClick={() => selectModel(entry)}><i /><span>{entry.name}</span>{persisted.favoriteModelIds.includes(entry.id) && <Star size={11} fill="currentColor" />}<ChevronRight size={14} /></button>)}</div></div>
      <div className="progress-card"><div><span>Quiz progress</span><b>{completion}%</b></div><i><b style={{ width: `${completion}%` }} /></i><small>{completedCount} of {activityCount} questions completed</small></div>
    </aside>
    <main className="workspace">
      <header className="topbar"><div><span>{view === 'lessons' ? 'activities' : view}</span><ChevronRight size={13} /><b>{model.name}</b></div><div className="top-actions"><a href="/account"><CircleUserRound size={16} />Account</a><button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>{view !== 'lessons' && <button onClick={() => chooseView('lessons')}><ClipboardList size={16} />Open activities</button>}</div></header>
      <div className="center-pane">{renderCenter()}</div>
    </main>
    <MentorPanel model={model} selectedHotspot={selectedHotspot} messages={messages} typing={typing} onMessages={setMessages} onTyping={setTyping} mobileOpen={mentorOpen} onMobileClose={() => setMentorOpen(false)} />
    <nav className="mobile-tabs">{navItems.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => chooseView(item.id)}><item.icon size={18} /><span>{item.label}</span></button>)}</nav>
    <button className="mobile-mentor-button" onClick={() => setMentorOpen(true)}><Bot size={15} />Mentor{typing && <i />}</button>
  </div>
}

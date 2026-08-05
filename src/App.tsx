import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { Bookmark, BookOpen, ChevronRight, CircuitBoard, ClipboardList, ExternalLink, Library, Menu, Moon, Network, NotebookPen, PanelLeftClose, PanelLeftOpen, Search, Sparkles, Star, Sun, X } from 'lucide-react'
import { AnatomyViewer } from './components/AnatomyViewer'
import { MentorPanel } from './components/MentorPanel'
import { LibraryView, NotesView, QuizzesView, SystemsView } from './components/WorkspaceViews'
import { anatomyModels, engineeringModels, modelById, models } from './data/models'
import logoUrl from '../Logo Stranerd.png'
import iconUrl from '../Icon Logo Stranerd.png'
import { allQuizzes, evaluateQuiz, quizzesForModel } from './data/quizzes'
import { askMentor } from './lib/mentor'
import { loadState, saveState } from './lib/storage'
import { anatomyGraph, anatomyLayers } from './data/anatomyGraph'
import type { ChatItem, Evaluation, Hotspot, ModelEntry, PersistedState, Quiz, ViewId } from './types'
import type { DissectionActionContext } from './data/dissection'
import { DissectionActivitiesView } from './components/DissectionActivitiesView'
import { anatomyActivities, type AnatomyActivity } from './data/activities'
import { digestiveDissectionQuiz } from './data/dissection'
import { generateAIQuiz } from './lib/quiz'

const navItems: { id: ViewId; label: string; icon: typeof Search }[] = [
  { id: 'explore', label: 'Explore', icon: Search },
  { id: 'systems', label: 'Systems', icon: Network },
  { id: 'lessons', label: 'Activities', icon: BookOpen },
  { id: 'engineering', label: 'Engineering', icon: CircuitBoard },
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
  return <div className="brand"><img className="brand-full" src={logoUrl} alt="Stranerd" /><img className="brand-icon" src={iconUrl} alt="" /><span>Anatomy + engineering</span></div>
}

type DetailProps = {
  model: ModelEntry
  hotspot?: Hotspot
  comparisonId: string
  bookmarked: boolean
  onComparison: (id: string) => void
  onBookmark: () => void
  onOpenModel: (model: ModelEntry) => void
}

function detailedModelFor(hotspot?: Hotspot) {
  if (!hotspot) return undefined
  const text = `${hotspot.label} ${hotspot.systemId || ''}`.toLowerCase()
  const match = [
    ['heart coronary myocard aorta ventricle atrium', 'heart'], ['brain cerebral cerebell', 'brain'], ['lung bronch trachea', 'lungs'],
    ['kidney renal ureter', 'kidney'], ['eye optic retina cornea', 'eye'], ['intestin colon cecum appendix', 'digestive-system'],
    ['liver hepatic portal', 'liver'], ['nerve spinal nervous', 'nervous-system'], ['skin derm epiderm', 'skin'],
  ].find(([terms]) => terms.split(' ').some((term) => text.includes(term)))
  return match ? modelById(match[1]) : undefined
}

function ModelDetail({ model, hotspot, comparisonId, bookmarked, onComparison, onBookmark, onOpenModel }: DetailProps) {
  const comparison = comparisonId ? modelById(comparisonId) : undefined
  const detailedModel = model.viewer === 'segmented-body' ? detailedModelFor(hotspot) : undefined
  return <section className="model-detail panel anim2"><div className="study-hero"><span className="eyebrow">{hotspot ? 'Now exploring' : 'Study brief'}</span><div className="detail-heading"><h2>{hotspot?.label || model.metadata.focus}</h2>{hotspot && <button className={bookmarked ? 'active' : ''} onClick={onBookmark} aria-pressed={bookmarked}><Bookmark size={15} fill={bookmarked ? 'currentColor' : 'none'} />{bookmarked ? 'Saved' : 'Save'}</button>}</div><p>{hotspot?.detail || model.description}</p><div className="study-meta"><span><small>System</small><b>{anatomyLayers.find((layer) => layer.id === hotspot?.systemId)?.label || model.system}</b></span><span><small>Region</small><b>{model.metadata.region}</b></span><span><small>Focus</small><b>{model.metadata.focus}</b></span></div>{detailedModel && <button className="detail-launch" onClick={() => onOpenModel(detailedModel)}>Open detailed {detailedModel.name} specimen<ExternalLink size={15} /></button>}</div><div className="study-connections">{hotspot?.conditions && hotspot.conditions.length > 0 ? <div className="condition-links"><span>Connected topics</span><div>{hotspot.conditions.slice(0, 4).map((condition) => <article key={condition.id}><b>{condition.label}</b><p>{condition.summary}</p></article>)}</div></div> : <div className="fact-list">{model.facts.map((fact, index) => <div key={fact}><span>{String(index + 1).padStart(2, '0')}</span><p>{fact}</p></div>)}</div>}<div className="compare"><label htmlFor="compare-model">Compare with another model</label><select id="compare-model" value={comparisonId} onChange={(event) => onComparison(event.target.value)}><option value="">Choose a model</option>{models.filter((entry) => entry.id !== model.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>{comparison && <div className="comparison"><span>{comparison.system}</span><h3>{comparison.name}</h3><p>{comparison.facts[0]}</p></div>}</div></div></section>
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [persisted, setPersisted] = useState<PersistedState>(loadInitialState)
  const [view, setView] = useState<ViewId>('explore')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot>()
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizChoice, setQuizChoice] = useState<number>()
  const [quizResult, setQuizResult] = useState<Evaluation>()
  const [quizSeed, setQuizSeed] = useState(() => crypto.getRandomValues(new Uint32Array(1))[0])
  const [generatedQuizSet, setGeneratedQuizSet] = useState<{ modelId: string; quizzes: Quiz[] }>()
  const [generatingQuiz, setGeneratingQuiz] = useState(false)
  const [activityMode, setActivityMode] = useState<'quiz' | 'dissection'>('quiz')
  const [activeActivityId, setActiveActivityId] = useState<string>()
  const [guidedActivityStep, setGuidedActivityStep] = useState<number | null>(null)
  const [activityQuizChoice, setActivityQuizChoice] = useState<number>()
  const [activityQuizPassed, setActivityQuizPassed] = useState<boolean>()
  const [messages, setMessages] = useState<ChatItem[]>([greeting])
  const [typing, setTyping] = useState(false)
  const [comparisonId, setComparisonId] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const model = modelById(persisted.selectedModelId)
  const fallbackQuizzes = useMemo(() => quizzesForModel(model.id, quizSeed), [model.id, quizSeed])
  const modelQuizzes = generatedQuizSet?.modelId === model.id ? generatedQuizSet.quizzes : fallbackQuizzes
  const quiz = modelQuizzes[quizIndex] ?? modelQuizzes[0]
  const savedVariantId = persisted.selectedVariantIds[model.id]
  const selectedVariantId = model.variants.some((variant) => variant.id === savedVariantId) ? savedVariantId! : model.variants[0].id
  const favorite = persisted.favoriteModelIds.includes(model.id)
  const bookmarkRef = selectedHotspot ? `${model.id}:${selectedHotspot.id}` : ''
  const bookmarked = bookmarkRef ? persisted.bookmarkedHotspotRefs.includes(bookmarkRef) : false
  const completedCount = persisted.completedQuizIds.length
  const activityCount = allQuizzes.length
  const completion = Math.round((completedCount / activityCount) * 100)
  const sideModels = view === 'engineering' ? engineeringModels : anatomyModels
  const effectiveSidebarCollapsed = sidebarCollapsed || view === 'lessons'

  useEffect(() => {
    saveState(persisted)
  }, [persisted])

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('stranerd.theme', theme)
  }, [theme])

  function updatePersisted(next: Partial<PersistedState>) {
    setPersisted((current) => ({ ...current, ...next }))
  }

  function selectModel(next: ModelEntry) {
    updatePersisted({ selectedModelId: next.id })
    setSelectedIds([])
    setSelectedHotspot(undefined)
    setQuizIndex(0)
    setQuizChoice(undefined)
    setQuizResult(undefined)
    setGeneratedQuizSet(undefined)
    setActiveActivityId(undefined)
    setGuidedActivityStep(null)
    setComparisonId('')
    setMenuOpen(false)
  }

  function inspectModel(next: ModelEntry) {
    selectModel(next)
    setView(next.anatomy ? 'explore' : 'engineering')
  }

  function selectVariant(variantId: string) {
    updatePersisted({ selectedVariantIds: { ...persisted.selectedVariantIds, [model.id]: variantId } })
    setSelectedIds([])
    setSelectedHotspot(undefined)
  }

  async function selectHotspot(hotspot: Hotspot, multi: boolean, explain = true) {
    setSelectedHotspot(hotspot)
    setSelectedIds((current) => multi ? (current.includes(hotspot.id) ? current.filter((id) => id !== hotspot.id) : [...current, hotspot.id]) : [hotspot.id])
    if (multi || typing || !explain) return
    const contextMessage: ChatItem = { id: crypto.randomUUID(), role: 'engine', text: `SELECTED · ${hotspot.label}`, status: 'neutral' }
    setMessages((current) => [...current, contextMessage])
    setTyping(true)
    const explanation = await askMentor(`Introduce ${hotspot.label}. Explain what it is, what it does, and one useful relationship in concise educational language.`, {
      model: model.name,
      hotspot: hotspot.label,
      nodeId: hotspot.nodeId,
      system: anatomyLayers.find((layer) => layer.id === hotspot.systemId)?.label || model.system,
      conditions: hotspot.conditions?.map((condition) => condition.label),
      graphVersion: hotspot.source === 'mesh' ? anatomyGraph.contentVersion : undefined,
      facts: model.facts,
    }, `${hotspot.detail} ${hotspot.conditions?.[0] ? `A related study topic is ${hotspot.conditions[0].label}.` : ''}`)
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'mentor', text: explanation }])
    setTyping(false)
  }

  async function explainDissectionAction(context: DissectionActionContext) {
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
    if (typing) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'mentor', text: fallback }])
      return
    }
    setTyping(true)
    const explanation = await askMentor(`Explain what this dissection action reveals and one important spatial or functional relationship.`, {
      model: model.name,
      system: context.system,
      mode: context.mode,
      action: context.action,
      structureIds: context.structureIds,
      structures: context.structures,
      hiddenStructures: context.hiddenStructures,
      visibleNeighbors: context.visibleNeighbors,
      guidedStep: context.guidedStep,
      graphVersion: anatomyGraph.contentVersion,
      facts: model.facts,
    }, fallback)
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'mentor', text: explanation }])
    setTyping(false)
  }

  function chooseView(next: ViewId) {
    if (next === 'engineering' && model.anatomy) selectModel(engineeringModels[0])
    if (next === 'explore' && !model.anatomy) selectModel(anatomyModels[0])
    setView(next)
    setMenuOpen(false)
  }

  function toggleFavorite(modelId: string) {
    const exists = persisted.favoriteModelIds.includes(modelId)
    updatePersisted({ favoriteModelIds: exists ? persisted.favoriteModelIds.filter((id) => id !== modelId) : [...persisted.favoriteModelIds, modelId] })
  }

  function toggleBookmark() {
    if (!bookmarkRef) return
    updatePersisted({ bookmarkedHotspotRefs: bookmarked ? persisted.bookmarkedHotspotRefs.filter((ref) => ref !== bookmarkRef) : [...persisted.bookmarkedHotspotRefs, bookmarkRef] })
  }

  function inspectBookmark(nextModel: ModelEntry, hotspot: Hotspot) {
    updatePersisted({ selectedModelId: nextModel.id })
    setQuizChoice(undefined)
    setQuizResult(undefined)
    setSelectedIds([hotspot.id])
    setSelectedHotspot(hotspot)
    setComparisonId('')
    setMenuOpen(false)
    setView(nextModel.anatomy ? 'explore' : 'engineering')
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
    setGeneratingQuiz(true)
    const nextSeed = crypto.getRandomValues(new Uint32Array(1))[0]
    const fallback = quizzesForModel(model.id, nextSeed)
    const quizzes = await generateAIQuiz(model, modelQuizzes.map((quiz) => quiz.question), fallback)
    setQuizSeed(nextSeed)
    setGeneratedQuizSet({ modelId: model.id, quizzes })
    restartQuiz()
    setGeneratingQuiz(false)
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
  const quizView = <QuizzesView model={model} quizzes={modelQuizzes} quizIndex={quizIndex} quizChoice={quizChoice} result={quizResult} completed={persisted.completedQuizIds} onQuiz={chooseQuiz} onQuizChoice={(index) => { setQuizChoice(index); setQuizResult(undefined) }} onQuizEvaluate={evaluateKnowledgeQuiz} onRestart={restartQuiz} onNewQuiz={takeNewAIQuiz} generatingQuiz={generatingQuiz} />
  const detail = <ModelDetail model={model} hotspot={selectedHotspot} comparisonId={comparisonId} bookmarked={bookmarked} onComparison={setComparisonId} onBookmark={toggleBookmark} onOpenModel={inspectModel} />

  function renderCenter() {
    if (view === 'systems') return <SystemsView onOpen={inspectModel} />
    if (view === 'library') return <LibraryView onOpen={inspectModel} favorites={persisted.favoriteModelIds} onFavorite={toggleFavorite} />
    if (view === 'notes') return <NotesView notes={persisted.notes} model={model} hotspotId={selectedHotspot?.id} bookmarks={persisted.bookmarkedHotspotRefs} onNotes={(notes) => updatePersisted({ notes })} onRemoveBookmark={(ref) => updatePersisted({ bookmarkedHotspotRefs: persisted.bookmarkedHotspotRefs.filter((item) => item !== ref) })} onInspectBookmark={inspectBookmark} />
    if (view === 'lessons') return <div className="lesson-workspace activity-workspace">{viewer}<div className="activity-pane"><nav className="activity-tabs"><button className={activityMode === 'quiz' ? 'active' : ''} onClick={() => setActivityMode('quiz')}>Quick quiz</button><button className={activityMode === 'dissection' ? 'active' : ''} onClick={() => setActivityMode('dissection')}>Dissection labs</button></nav>{activityMode === 'quiz' ? quizView : <DissectionActivitiesView activeActivityId={activeActivityId} modelId={model.id} onLaunch={launchDissectionActivity} guidedStep={guidedActivityStep} quizChoice={activityQuizChoice} quizPassed={activityQuizPassed} onStartGuide={() => { setGuidedActivityStep(0); setActivityQuizChoice(undefined); setActivityQuizPassed(undefined) }} onQuizChoice={(choice) => { setActivityQuizChoice(choice); setActivityQuizPassed(undefined) }} onQuizCheck={checkActivityQuestion} onStepContinue={continueActivity} />}</div></div>
    if (view === 'engineering') return <section className="engineering-view"><header className="engineering-intro"><div><span className="eyebrow">Board lab preview</span><h1>Inspect components, then test your understanding.</h1><p>Click authored board-level markers for mentor explanations and answer short contextual quizzes.</p></div><label htmlFor="board-model">Board specimen<select id="board-model" value={model.id} onChange={(event) => selectModel(modelById(event.target.value))}>{engineeringModels.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label></header><div className="engineering-grid">{viewer}{quizView}</div>{detail}</section>
    return <div className="explore-view">{viewer}{detail}</div>
  }

  return <div className={`app-shell ${effectiveSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <header className="mobile-head"><Brand /><button onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button></header>
    <aside className={`sidebar ${menuOpen ? 'open' : ''} ${effectiveSidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="side-brand"><Brand /><button onClick={() => setSidebarCollapsed((value) => !value)} aria-label={effectiveSidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}>{effectiveSidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
      <nav>{navItems.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => chooseView(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.id === 'library' && persisted.favoriteModelIds.length > 0 && <b>{persisted.favoriteModelIds.length}</b>}{item.id === 'notes' && persisted.notes.length + persisted.bookmarkedHotspotRefs.length > 0 && <b>{persisted.notes.length + persisted.bookmarkedHotspotRefs.length}</b>}</button>)}</nav>
      <div className="side-section"><header><span>{view === 'engineering' ? 'Boards' : 'Anatomy models'}</span><button onClick={() => chooseView('library')}>All {models.length}</button></header><div className="model-list">{sideModels.map((entry) => <button key={entry.id} className={entry.id === model.id ? 'active' : ''} onClick={() => selectModel(entry)}><i /><span>{entry.name}</span>{persisted.favoriteModelIds.includes(entry.id) && <Star size={11} fill="currentColor" />}<ChevronRight size={14} /></button>)}</div></div>
      <div className="progress-card"><div><span>Quiz progress</span><b>{completion}%</b></div><i><b style={{ width: `${completion}%` }} /></i><small>{completedCount} of {activityCount} questions completed</small></div>
    </aside>
    <main className="workspace">
      <header className="topbar"><div><span>{view === 'lessons' ? 'activities' : view}</span><ChevronRight size={13} /><b>{model.name}</b></div><div className="top-actions"><button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>{view !== 'lessons' && <button onClick={() => chooseView('lessons')}><ClipboardList size={16} />Open activities</button>}</div></header>
      <div className="center-pane">{renderCenter()}</div>
    </main>
    <MentorPanel model={model} selectedHotspot={selectedHotspot} messages={messages} typing={typing} onMessages={setMessages} onTyping={setTyping} />
    <nav className="mobile-tabs">{navItems.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => chooseView(item.id)}><item.icon size={18} /><span>{item.label}</span></button>)}</nav>
    <div className="mobile-mentor-badge"><Sparkles size={13} /> Mentor below</div>
  </div>
}

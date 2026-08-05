import { useEffect, useLayoutEffect, useState } from 'react'
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
import type { ChatItem, Evaluation, Hotspot, ModelEntry, PersistedState, ViewId } from './types'

const navItems: { id: ViewId; label: string; icon: typeof Search }[] = [
  { id: 'explore', label: 'Explore', icon: Search },
  { id: 'systems', label: 'Systems', icon: Network },
  { id: 'lessons', label: 'Quizzes', icon: BookOpen },
  { id: 'engineering', label: 'Engineering', icon: CircuitBoard },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
]

const greeting: ChatItem = {
  id: 'mentor-welcome',
  role: 'mentor',
  text: 'Click a structure to explore it with me, or open Quizzes to test what you have learned.',
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
  const [messages, setMessages] = useState<ChatItem[]>([greeting])
  const [typing, setTyping] = useState(false)
  const [comparisonId, setComparisonId] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const model = modelById(persisted.selectedModelId)
  const modelQuizzes = quizzesForModel(model.id)
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
    setComparisonId('')
    setMenuOpen(false)
  }

  function inspectModel(next: ModelEntry) {
    selectModel(next)
    setView(next.anatomy ? 'explore' : 'engineering')
  }

  async function selectHotspot(hotspot: Hotspot, multi: boolean) {
    setSelectedHotspot(hotspot)
    setSelectedIds((current) => multi ? (current.includes(hotspot.id) ? current.filter((id) => id !== hotspot.id) : [...current, hotspot.id]) : [hotspot.id])
    if (multi || typing) return
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

  const viewer = <AnatomyViewer model={model} selectedIds={selectedIds} selectedHotspot={selectedHotspot} settings={persisted.settings} selectedVariantId={selectedVariantId} favorite={favorite} onSelect={selectHotspot} onSettings={(settings) => updatePersisted({ settings })} onVariant={(variantId) => updatePersisted({ selectedVariantIds: { ...persisted.selectedVariantIds, [model.id]: variantId } })} onFavorite={() => toggleFavorite(model.id)} />
  const quizView = <QuizzesView model={model} quizzes={modelQuizzes} quizIndex={quizIndex} quizChoice={quizChoice} result={quizResult} completed={persisted.completedQuizIds} onQuiz={chooseQuiz} onQuizChoice={(index) => { setQuizChoice(index); setQuizResult(undefined) }} onQuizEvaluate={evaluateKnowledgeQuiz} />
  const detail = <ModelDetail model={model} hotspot={selectedHotspot} comparisonId={comparisonId} bookmarked={bookmarked} onComparison={setComparisonId} onBookmark={toggleBookmark} onOpenModel={inspectModel} />

  function renderCenter() {
    if (view === 'systems') return <SystemsView onOpen={inspectModel} />
    if (view === 'library') return <LibraryView onOpen={inspectModel} favorites={persisted.favoriteModelIds} onFavorite={toggleFavorite} />
    if (view === 'notes') return <NotesView notes={persisted.notes} model={model} hotspotId={selectedHotspot?.id} bookmarks={persisted.bookmarkedHotspotRefs} onNotes={(notes) => updatePersisted({ notes })} onRemoveBookmark={(ref) => updatePersisted({ bookmarkedHotspotRefs: persisted.bookmarkedHotspotRefs.filter((item) => item !== ref) })} onInspectBookmark={inspectBookmark} />
    if (view === 'lessons') return <div className="lesson-workspace">{viewer}{quizView}</div>
    if (view === 'engineering') return <section className="engineering-view"><header className="engineering-intro"><div><span className="eyebrow">Board lab preview</span><h1>Inspect components, then test your understanding.</h1><p>Click authored board-level markers for mentor explanations and answer short contextual quizzes.</p></div><label htmlFor="board-model">Board specimen<select id="board-model" value={model.id} onChange={(event) => selectModel(modelById(event.target.value))}>{engineeringModels.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label></header><div className="engineering-grid">{viewer}{quizView}</div>{detail}</section>
    return <div className="explore-view">{viewer}{detail}</div>
  }

  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
    <header className="mobile-head"><Brand /><button onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button></header>
    <aside className={`sidebar ${menuOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="side-brand"><Brand /><button onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}>{sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
      <nav>{navItems.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => chooseView(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.id === 'library' && persisted.favoriteModelIds.length > 0 && <b>{persisted.favoriteModelIds.length}</b>}{item.id === 'notes' && persisted.notes.length + persisted.bookmarkedHotspotRefs.length > 0 && <b>{persisted.notes.length + persisted.bookmarkedHotspotRefs.length}</b>}</button>)}</nav>
      <div className="side-section"><header><span>{view === 'engineering' ? 'Boards' : 'Anatomy models'}</span><button onClick={() => chooseView('library')}>All {models.length}</button></header><div className="model-list">{sideModels.map((entry) => <button key={entry.id} className={entry.id === model.id ? 'active' : ''} onClick={() => selectModel(entry)}><i /><span>{entry.name}</span>{persisted.favoriteModelIds.includes(entry.id) && <Star size={11} fill="currentColor" />}<ChevronRight size={14} /></button>)}</div></div>
      <div className="progress-card"><div><span>Quiz progress</span><b>{completion}%</b></div><i><b style={{ width: `${completion}%` }} /></i><small>{completedCount} of {activityCount} questions completed</small></div>
    </aside>
    <main className="workspace">
      <header className="topbar"><div><span>{view === 'lessons' ? 'quizzes' : view}</span><ChevronRight size={13} /><b>{model.name}</b></div><div className="top-actions"><button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button>{view !== 'lessons' && <button onClick={() => chooseView('lessons')}><ClipboardList size={16} />Open quiz</button>}</div></header>
      <div className="center-pane">{renderCenter()}</div>
    </main>
    <MentorPanel model={model} selectedHotspot={selectedHotspot} messages={messages} typing={typing} onMessages={setMessages} onTyping={setTyping} />
    <nav className="mobile-tabs">{navItems.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => chooseView(item.id)}><item.icon size={18} /><span>{item.label}</span></button>)}</nav>
    <div className="mobile-mentor-badge"><Sparkles size={13} /> Mentor below</div>
  </div>
}

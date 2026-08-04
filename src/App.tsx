import { useEffect, useLayoutEffect, useState } from 'react'
import { Activity, Bookmark, BookOpen, CheckCircle2, ChevronRight, CircleHelp, CircuitBoard, ClipboardList, Library, Menu, Moon, Network, NotebookPen, Search, Sparkles, Star, Sun, X } from 'lucide-react'
import { AnatomyViewer } from './components/AnatomyViewer'
import { MentorPanel } from './components/MentorPanel'
import { LessonsView, LibraryView, NotesView, SystemsView } from './components/WorkspaceViews'
import { anatomyModels, engineeringModels, modelById, models } from './data/models'
import { lessons, lessonsForModel } from './data/lessons'
import { evaluateQuiz, quizForModel, quizzes } from './data/quizzes'
import { askMentor } from './lib/mentor'
import { loadState, saveState } from './lib/storage'
import type { ChatItem, Hotspot, Lesson, ModelEntry, PersistedState, ViewId } from './types'

const navItems: { id: ViewId; label: string; icon: typeof Search }[] = [
  { id: 'explore', label: 'Explore', icon: Search },
  { id: 'systems', label: 'Systems', icon: Network },
  { id: 'lessons', label: 'Lessons', icon: BookOpen },
  { id: 'engineering', label: 'Engineering', icon: CircuitBoard },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
]

const greeting: ChatItem = {
  id: 'mentor-welcome',
  role: 'mentor',
  text: 'Select an authored coordinate marker to inspect a structure, or open Lessons for an exact, deterministic task.',
}

type Theme = 'dark' | 'light'

function loadTheme(): Theme {
  return window.localStorage.getItem('stranerd.theme') === 'light' ? 'light' : 'dark'
}

function Brand() {
  return <div className="brand"><i /><div><strong>STRANERD</strong><span>Anatomy + engineering</span></div></div>
}

type DetailProps = {
  model: ModelEntry
  hotspot?: Hotspot
  comparisonId: string
  bookmarked: boolean
  onComparison: (id: string) => void
  onBookmark: () => void
}

function ModelDetail({ model, hotspot, comparisonId, bookmarked, onComparison, onBookmark }: DetailProps) {
  const comparison = comparisonId ? modelById(comparisonId) : undefined
  return <section className="model-detail panel anim2"><div className="detail-copy"><span className="eyebrow">{hotspot ? 'Selected marker' : 'Study brief'}</span><div className="detail-heading"><h2>{hotspot?.label || model.metadata.focus}</h2>{hotspot && <button className={bookmarked ? 'active' : ''} onClick={onBookmark} aria-pressed={bookmarked}><Bookmark size={15} fill={bookmarked ? 'currentColor' : 'none'} />{bookmarked ? 'Bookmarked' : 'Bookmark'}</button>}</div><p>{hotspot?.detail || model.description}</p><div className="fact-list">{model.facts.map((fact, index) => <div key={fact}><span>{String(index + 1).padStart(2, '0')}</span><p>{fact}</p></div>)}</div></div><div className="compare"><label htmlFor="compare-model">Compare facts</label><select id="compare-model" value={comparisonId} onChange={(event) => onComparison(event.target.value)}><option value="">Choose another model</option>{models.filter((entry) => entry.id !== model.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select>{comparison && <div className="comparison"><span>{comparison.system}</span><h3>{comparison.name}</h3><p>{comparison.facts[0]}</p><small>{comparison.metadata.region} · {comparison.metadata.scale}</small></div>}</div></section>
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [persisted, setPersisted] = useState<PersistedState>(loadState)
  const [view, setView] = useState<ViewId>('explore')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot>()
  const initialModel = modelById(persisted.selectedModelId)
  const [activeLesson, setActiveLesson] = useState<Lesson>(() => lessonsForModel(initialModel.id)[0])
  const [quizChoice, setQuizChoice] = useState<number>()
  const [messages, setMessages] = useState<ChatItem[]>([greeting])
  const [typing, setTyping] = useState(false)
  const [comparisonId, setComparisonId] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const model = modelById(persisted.selectedModelId)
  const modelLessons = lessonsForModel(model.id)
  const quiz = quizForModel(model.id)
  const selectedVariantId = persisted.selectedVariantIds[model.id] ?? model.variants[0].id
  const favorite = persisted.favoriteModelIds.includes(model.id)
  const bookmarkRef = selectedHotspot ? `${model.id}:${selectedHotspot.id}` : ''
  const bookmarked = bookmarkRef ? persisted.bookmarkedHotspotRefs.includes(bookmarkRef) : false
  const completedCount = persisted.completedLessonIds.length + persisted.completedQuizIds.length
  const activityCount = lessons.length + quizzes.length
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
    setActiveLesson(lessonsForModel(next.id)[0])
    setSelectedIds([])
    setSelectedHotspot(undefined)
    setQuizChoice(undefined)
    setComparisonId('')
    setMenuOpen(false)
  }

  function inspectModel(next: ModelEntry) {
    selectModel(next)
    setView(next.anatomy ? 'explore' : 'engineering')
  }

  function selectHotspot(hotspot: Hotspot, multi: boolean) {
    setSelectedHotspot(hotspot)
    setSelectedIds((current) => multi ? (current.includes(hotspot.id) ? current.filter((id) => id !== hotspot.id) : [...current, hotspot.id]) : [hotspot.id])
  }

  function chooseView(next: ViewId) {
    if (next === 'engineering' && model.anatomy) selectModel(engineeringModels[0])
    if (next === 'explore' && !model.anatomy) selectModel(anatomyModels[0])
    setView(next)
    setMenuOpen(false)
  }

  function openLesson(next: Lesson) {
    setActiveLesson(next)
    setSelectedIds([])
    setSelectedHotspot(undefined)
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
    setActiveLesson(lessonsForModel(nextModel.id)[0])
    setQuizChoice(undefined)
    setSelectedIds([hotspot.id])
    setSelectedHotspot(hotspot)
    setComparisonId('')
    setMenuOpen(false)
    setView(nextModel.anatomy ? 'explore' : 'engineering')
  }

  async function evaluateLesson() {
    const result = activeLesson.evaluate({ selectedIds })
    const engineMessage: ChatItem = { id: crypto.randomUUID(), role: 'engine', status: result.pass ? 'pass' : 'fail', text: `${result.pass ? 'PASS' : 'RETRY'} · ${result.detail}` }
    const nextMessages = [...messages, engineMessage]
    setMessages(nextMessages)
    if (result.pass && !persisted.completedLessonIds.includes(activeLesson.id)) updatePersisted({ completedLessonIds: [...persisted.completedLessonIds, activeLesson.id] })
    setTyping(true)
    const explanation = await askMentor('Explain this deterministic lesson result.', {
      model: model.name,
      task: activeLesson.prompt,
      hotspot: selectedHotspot?.label,
      engineResult: `${result.pass ? 'PASS' : 'RETRY'}: ${result.detail}`,
      facts: model.facts,
    }, result.pass ? activeLesson.fallback : `The engine found a mismatch. ${activeLesson.hints[0]} The required IDs are fixed by the authored task, not judged by AI.`)
    setMessages([...nextMessages, { id: crypto.randomUUID(), role: 'mentor', text: explanation }])
    setTyping(false)
  }

  async function evaluateKnowledgeQuiz() {
    const result = evaluateQuiz(quiz, quizChoice)
    const engineMessage: ChatItem = { id: crypto.randomUUID(), role: 'engine', status: result.pass ? 'pass' : 'fail', text: `QUIZ ${result.pass ? 'PASS' : 'RETRY'} · ${result.detail}` }
    const nextMessages = [...messages, engineMessage]
    setMessages(nextMessages)
    if (result.pass && !persisted.completedQuizIds.includes(quiz.id)) updatePersisted({ completedQuizIds: [...persisted.completedQuizIds, quiz.id] })
    setTyping(true)
    const explanation = await askMentor('Explain the already-graded authored knowledge check.', {
      model: model.name,
      task: quiz.question,
      engineResult: `${result.pass ? 'PASS' : 'RETRY'}: ${result.detail}`,
      facts: model.facts,
    }, result.pass ? quiz.explanation : `The deterministic engine marked that option incorrect. ${quiz.explanation}`)
    setMessages([...nextMessages, { id: crypto.randomUUID(), role: 'mentor', text: explanation }])
    setTyping(false)
  }

  const viewer = <AnatomyViewer model={model} selectedIds={selectedIds} selectedHotspot={selectedHotspot} settings={persisted.settings} selectedVariantId={selectedVariantId} favorite={favorite} onSelect={selectHotspot} onSettings={(settings) => updatePersisted({ settings })} onVariant={(variantId) => updatePersisted({ selectedVariantIds: { ...persisted.selectedVariantIds, [model.id]: variantId } })} onFavorite={() => toggleFavorite(model.id)} />
  const lessonView = <LessonsView model={model} lessons={modelLessons} active={activeLesson} completed={persisted.completedLessonIds} selectedIds={selectedIds} quiz={quiz} quizChoice={quizChoice} quizCompleted={persisted.completedQuizIds.includes(quiz.id)} onActive={openLesson} onEvaluate={evaluateLesson} onHint={(text) => setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'mentor', text }])} onQuizChoice={setQuizChoice} onQuizEvaluate={evaluateKnowledgeQuiz} />
  const detail = <ModelDetail model={model} hotspot={selectedHotspot} comparisonId={comparisonId} bookmarked={bookmarked} onComparison={setComparisonId} onBookmark={toggleBookmark} />

  function renderCenter() {
    if (view === 'systems') return <SystemsView onOpen={inspectModel} />
    if (view === 'library') return <LibraryView onOpen={inspectModel} favorites={persisted.favoriteModelIds} onFavorite={toggleFavorite} />
    if (view === 'notes') return <NotesView notes={persisted.notes} model={model} hotspotId={selectedHotspot?.id} bookmarks={persisted.bookmarkedHotspotRefs} onNotes={(notes) => updatePersisted({ notes })} onRemoveBookmark={(ref) => updatePersisted({ bookmarkedHotspotRefs: persisted.bookmarkedHotspotRefs.filter((item) => item !== ref) })} onInspectBookmark={inspectBookmark} />
    if (view === 'lessons') return <div className="lesson-workspace">{viewer}{lessonView}</div>
    if (view === 'engineering') return <section className="engineering-view"><header className="engineering-intro"><div><span className="eyebrow">Board lab preview</span><h1>Component identification, not circuit simulation.</h1><p>Inspect authored board-level markers, then run exact identification tasks before the mentor explains the result.</p></div><label htmlFor="board-model">Board specimen<select id="board-model" value={model.id} onChange={(event) => selectModel(modelById(event.target.value))}>{engineeringModels.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label></header><div className="engineering-grid">{viewer}{lessonView}</div>{detail}</section>
    return <div className="explore-view">{viewer}{detail}</div>
  }

  return <div className="app-shell">
    <header className="mobile-head"><Brand /><button onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button></header>
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <Brand />
      <nav>{navItems.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => chooseView(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.id === 'library' && persisted.favoriteModelIds.length > 0 && <b>{persisted.favoriteModelIds.length}</b>}{item.id === 'notes' && persisted.notes.length + persisted.bookmarkedHotspotRefs.length > 0 && <b>{persisted.notes.length + persisted.bookmarkedHotspotRefs.length}</b>}</button>)}</nav>
      <div className="side-section"><header><span>{view === 'engineering' ? 'Boards' : 'Anatomy models'}</span><button onClick={() => chooseView('library')}>All {models.length}</button></header><div className="model-list">{sideModels.map((entry) => <button key={entry.id} className={entry.id === model.id ? 'active' : ''} onClick={() => selectModel(entry)}><i /><span>{entry.name}</span>{persisted.favoriteModelIds.includes(entry.id) && <Star size={11} fill="currentColor" />}<ChevronRight size={14} /></button>)}</div></div>
      <div className="progress-card"><div><span>Learning progress</span><b>{completion}%</b></div><i><b style={{ width: `${completion}%` }} /></i><small>{completedCount} of {activityCount} deterministic activities complete</small></div>
      <div className="engine-status"><Activity size={15} /><span><b>Correctness engine</b>Deterministic · ready</span><i /></div>
    </aside>
    <main className="workspace">
      <header className="topbar"><div><span>{view}</span><ChevronRight size={13} /><b>{model.name}</b></div><div className="top-actions"><button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}<span>{theme === 'dark' ? 'Light' : 'Dark'}</span></button><span className="demo-tag">ENGINE-GRADED</span>{view === 'lessons' || view === 'engineering' ? <button className="primary" onClick={evaluateLesson}><CheckCircle2 size={16} />Evaluate</button> : <button onClick={() => chooseView('lessons')}><ClipboardList size={16} />Open lesson</button>}</div></header>
      <div className="center-pane">{renderCenter()}</div>
      <footer className="disclaimer"><CircleHelp size={14} />Educational visualization only. Not medical advice or a diagnostic tool.<span>STRANERD · 2026</span></footer>
    </main>
    <MentorPanel model={model} lesson={view === 'lessons' || view === 'engineering' ? activeLesson : undefined} selectedHotspot={selectedHotspot?.label} messages={messages} typing={typing} onMessages={setMessages} onTyping={setTyping} />
    <nav className="mobile-tabs">{navItems.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => chooseView(item.id)}><item.icon size={18} /><span>{item.label}</span></button>)}</nav>
    <div className="mobile-mentor-badge"><Sparkles size={13} /> Mentor below</div>
  </div>
}

import { useMemo, useState } from 'react'
import { ArrowRight, Bookmark, Check, Edit3, Lightbulb, Plus, Search, Star, Trash2 } from 'lucide-react'
import { models, systems } from '../data/models'
import type { Hotspot, ModelEntry, Note, Quiz } from '../types'

export function SystemsView({ onOpen }: { onOpen: (model: ModelEntry) => void }) {
  return <section className="content-view anim">
    <div className="view-title"><span className="eyebrow">Organ systems</span><h1>Connected by function.</h1><p>Move from system-level purpose to an explorable component.</p></div>
    <div className="system-grid">{systems.map((system, index) => {
      const entries = models.filter((model) => model.system === system)
      return <article className="system-card" key={system}><span>{String(index + 1).padStart(2, '0')}</span><h2>{system}</h2><p>{entries.map((entry) => entry.name).join(' · ')}</p><button onClick={() => onOpen(entries[0])}>Open {entries[0].name}<ArrowRight size={16} /></button></article>
    })}</div>
  </section>
}

type LibraryProps = { onOpen: (model: ModelEntry) => void; favorites: string[]; onFavorite: (modelId: string) => void }

export function LibraryView({ onOpen, favorites, onFavorite }: LibraryProps) {
  const [query, setQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const filtered = useMemo(() => models.filter((model) => (!favoritesOnly || favorites.includes(model.id)) && `${model.name} ${model.system} ${model.description}`.toLowerCase().includes(query.toLowerCase())), [favorites, favoritesOnly, query])
  const grouped = filtered.reduce<Record<string, ModelEntry[]>>((result, model) => {
    result[model.system] = [...(result[model.system] ?? []), model]
    return result
  }, {})

  return <section className="content-view anim">
    <div className="view-title library-title"><div><span className="eyebrow">Specimen library</span><h1>Models with context.</h1><p>Ten anatomy studies spanning organs, systems, and whole-body relationships.</p></div><div className="library-filters"><label className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models or systems" /></label><button className={favoritesOnly ? 'active' : ''} onClick={() => setFavoritesOnly((value) => !value)} aria-pressed={favoritesOnly}><Star size={15} />Favorites only · {favorites.length}</button></div></div>
    {filtered.length === 0 && <div className="empty-state">No models match these filters.</div>}
    {Object.entries(grouped).map(([system, entries]) => entries && <div className="library-group" key={system}><h2>{system}<span>{entries.length}</span></h2><div className="library-grid">{entries.map((model) => <article key={model.id} className="library-card"><div><div className="card-kicker"><span className="model-index">{model.variants.length} GLB {model.variants.length === 1 ? 'specimen' : 'specimens'}</span><button className={`favorite-button ${favorites.includes(model.id) ? 'active' : ''}`} onClick={() => onFavorite(model.id)} aria-label={`${favorites.includes(model.id) ? 'Remove' : 'Add'} ${model.name} favorite`} aria-pressed={favorites.includes(model.id)}><Star size={16} fill={favorites.includes(model.id) ? 'currentColor' : 'none'} /></button></div><h3>{model.name}</h3><em>{model.scientificName}</em><p>{model.description}</p></div><footer><span>{model.metadata.focus}</span><button onClick={() => onOpen(model)}>Inspect<ArrowRight size={15} /></button></footer></article>)}</div></div>)}
  </section>
}

type QuizProps = {
  model: ModelEntry
  quizzes: Quiz[]
  quizIndex: number
  answers: Record<number, number>
  submitted: boolean
  hints: Record<number, string>
  corrections?: string[]
  loadingHintIndex?: number
  loadingCorrections: boolean
  onQuiz: (index: number) => void
  onAnswer: (index: number) => void
  onSubmit: () => void
  onHint: (index: number) => void
  onNewAssessment: () => void
  onCorrections: () => void
  generatingAssessment: boolean
  aiError?: string
  aiNeedsCredits: boolean
  signedIn: boolean
  creditBalance?: number
}

export function QuizzesView({ model, quizzes, quizIndex, answers, submitted, hints, corrections, loadingHintIndex, loadingCorrections, onQuiz, onAnswer, onSubmit, onHint, onNewAssessment, onCorrections, generatingAssessment, aiError, aiNeedsCredits, signedIn, creditBalance }: QuizProps) {
  const quiz = quizzes[quizIndex]
  if (!quiz) return null
  const answeredCount = Object.keys(answers).length
  const selectedAnswer = answers[quizIndex]
  const score = submitted ? quizzes.reduce((total, entry, index) => total + (answers[index] === entry.correctIndex ? 1 : 0), 0) : 0
  const percentage = Math.round((score / quizzes.length) * 100)
  const correction = corrections?.[quizIndex]
  const balanceLabel = creditBalance === undefined ? 'Loading credits' : `${creditBalance} credits available`

  return <section className="content-view quiz-view assessment-view anim">
    <div className="view-title assessment-title">
      <div><span className="eyebrow">Model assessment</span><h1>{model.name} assessment</h1></div>
      <aside><span>Attempt progress</span><strong>{answeredCount}<small>/ {quizzes.length}</small></strong><i><b style={{ width: `${(answeredCount / quizzes.length) * 100}%` }} /></i></aside>
    </div>

    <div className="quiz-progress" aria-label="Assessment questions">{quizzes.map((entry, index) => <button key={entry.id} className={`${index === quizIndex ? 'active' : ''} ${answers[index] !== undefined ? 'complete' : ''}`} onClick={() => onQuiz(index)} aria-label={`Question ${index + 1}${answers[index] !== undefined ? ', answered' : ', unanswered'}`} aria-current={index === quizIndex ? 'step' : undefined}>{answers[index] !== undefined ? <Check size={12} /> : index + 1}</button>)}</div>
    {aiError && !aiNeedsCredits && <div className="ai-action-error"><span>{aiError}</span></div>}

    {submitted && !corrections ? <section className="assessment-result" aria-live="polite">
      <div><span>Assessment submitted</span><strong>{percentage}%</strong><p>{score} of {quizzes.length} questions correct</p></div>
      <div><h2>{percentage >= 70 ? 'Strong result.' : 'Keep building.'}</h2><p>Your score is final for this attempt. Unlock detailed AI corrections to review every answer.</p><small>{signedIn ? balanceLabel : 'Sign in to use AI assessment tools.'}</small><div><button className="assessment-review" onClick={onCorrections} disabled={loadingCorrections}>{loadingCorrections ? 'Preparing corrections…' : signedIn ? 'See AI corrections · 2 credits' : 'Sign in for corrections'}</button><button className="secondary" onClick={onNewAssessment} disabled={generatingAssessment}>{generatingAssessment ? 'Generating assessment…' : signedIn ? 'New assessment · 5 credits' : 'Sign in for new assessment'}<ArrowRight size={15} /></button></div></div>
    </section> : <article className="quiz-stage assessment-stage">
      <header><span>QUESTION {String(quizIndex + 1).padStart(2, '0')} · MULTIPLE CHOICE</span><div>{!submitted && <button className="hint-button" onClick={() => onHint(quizIndex)} disabled={loadingHintIndex !== undefined || Boolean(hints[quizIndex])}><Lightbulb size={14} />{hints[quizIndex] ? 'Hint unlocked' : loadingHintIndex === quizIndex ? 'Generating…' : signedIn ? 'Hint · 1 credit' : 'Sign in for hint'}</button>}<b>{quizIndex + 1} / {quizzes.length}</b></div></header>
      <h2>{quiz.question}</h2>
      <fieldset disabled={submitted}>{quiz.options.map((option, index) => {
        const correct = Boolean(corrections) && index === quiz.correctIndex
        const selected = selectedAnswer === index
        return <label key={option} className={corrections ? `${correct ? 'correction-correct' : ''} ${selected && !correct ? 'correction-selected' : ''}` : ''}><input type="radio" name={`quiz-${quiz.id}`} value={index} checked={selected} onChange={() => onAnswer(index)} /><span>{String.fromCharCode(65 + index)}</span><b>{option}</b>{corrections && correct && <Check size={15} />}</label>
      })}</fieldset>
      {hints[quizIndex] && <div className="assessment-hint"><Lightbulb size={15} /><div><strong>Hint</strong><p>{hints[quizIndex]}</p></div></div>}
      {correction && <div className="assessment-correction"><span>AI correction</span><h3>{selectedAnswer === quiz.correctIndex ? 'Your answer was correct.' : `Correct answer: ${quiz.options[quiz.correctIndex]}`}</h3><p>{correction}</p></div>}
      <footer><small>{submitted ? 'Detailed correction unlocked for this attempt.' : `${answeredCount} of ${quizzes.length} answered`}</small><div className="assessment-actions">{quizIndex > 0 && <button className="secondary" onClick={() => onQuiz(quizIndex - 1)}>Previous</button>}{quizIndex < quizzes.length - 1 && <button className="secondary" onClick={() => onQuiz(quizIndex + 1)}>Next<ArrowRight size={15} /></button>}{!submitted && answeredCount === quizzes.length && <button className="primary" onClick={onSubmit}>Submit</button>}</div></footer>
    </article>}
  </section>
}

type NotesProps = {
  notes: Note[]
  model: ModelEntry
  hotspotId?: string
  bookmarks: string[]
  onNotes: (notes: Note[]) => void
  onRemoveBookmark: (ref: string) => void
  onInspectBookmark: (model: ModelEntry, hotspot: Hotspot) => void
}

export function NotesView({ notes, model, hotspotId, bookmarks, onNotes, onRemoveBookmark, onInspectBookmark }: NotesProps) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string>()
  const visible = notes.filter((note) => note.modelId === model.id)
  const savedStructures = bookmarks.flatMap((ref) => {
    const separator = ref.indexOf(':')
    if (separator <= 0) return []
    const bookmarkedModel = models.find((entry) => entry.id === ref.slice(0, separator))
    const hotspot = bookmarkedModel?.hotspots.find((entry) => entry.id === ref.slice(separator + 1))
    return bookmarkedModel && hotspot ? [{ ref, model: bookmarkedModel, hotspot }] : []
  })

  function save() {
    if (!draft.trim()) return
    if (editing) onNotes(notes.map((note) => note.id === editing ? { ...note, text: draft.trim(), updatedAt: new Date().toISOString() } : note))
    else onNotes([...notes, { id: crypto.randomUUID(), modelId: model.id, hotspotId, text: draft.trim(), updatedAt: new Date().toISOString() }])
    setDraft('')
    setEditing(undefined)
  }

  return <section className="content-view notes-view anim">
    <div className="view-title"><span className="eyebrow">Field notes</span><h1>{model.name} notebook.</h1><p>Notes and saved structures stay on this device.</p></div>
    <div className="note-compose"><label htmlFor="note-text">{editing ? 'Edit note' : `New note · ${hotspotId || 'general model'}`}</label><textarea id="note-text" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Record an observation, relationship, or question…" /><button className="primary" onClick={save} disabled={!draft.trim()}><Plus size={16} />{editing ? 'Update note' : 'Add note'}</button></div>
    <div className="note-list">{visible.length === 0 && <div className="empty-state">No notes for this model yet.</div>}{visible.map((note) => <article key={note.id}><header><span>{note.hotspotId || 'GENERAL'}</span><time>{new Date(note.updatedAt).toLocaleDateString()}</time></header><p>{note.text}</p><footer><button onClick={() => { setEditing(note.id); setDraft(note.text) }}><Edit3 size={15} />Edit</button><button onClick={() => onNotes(notes.filter((item) => item.id !== note.id))}><Trash2 size={15} />Delete</button></footer></article>)}</div>
    <section className="saved-structures" aria-labelledby="saved-structures-title"><header><div><Bookmark size={17} /><h2 id="saved-structures-title">Saved structures</h2></div><span>{savedStructures.length} bookmarked</span></header>{savedStructures.length === 0 && <div className="empty-state">Bookmark a marker in Explore to keep it here.</div>}<div className="saved-grid">{savedStructures.map((item) => <article key={item.ref}><span>{item.model.name}</span><h3>{item.hotspot.label}</h3><p>{item.hotspot.detail}</p><footer><button onClick={() => onRemoveBookmark(item.ref)}><Trash2 size={14} />Remove</button><button onClick={() => onInspectBookmark(item.model, item.hotspot)}>Inspect<ArrowRight size={14} /></button></footer></article>)}</div></section>
  </section>
}

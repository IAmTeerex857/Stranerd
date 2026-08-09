import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ClipboardList, GalleryVerticalEnd, Lightbulb, Search, Star } from 'lucide-react'
import { models, systems } from '../data/models'
import { assessmentProgressForModel } from '../data/quizzes'
import { flashcardDeckForModel, flashcardProgress } from '../data/flashcards'
import type { FlashcardDeck, FlashcardDeckProgress, GeneratedDeckSummary, ModelEntry, Quiz } from '../types'

type ContentFilter = 'all' | 'models' | 'assessments' | 'flashcards'
type ProgressFilter = 'all' | 'not-started' | 'in-progress' | 'complete'
type LibraryProps = { onOpen: (model: ModelEntry) => void; onAssessment: (model: ModelEntry) => void; onFlashcards: (deck: FlashcardDeck) => void; onGenerate: (model: ModelEntry) => void; onGeneratedDeck: (deck: GeneratedDeckSummary) => void; onUnlockDeck: (deck: GeneratedDeckSummary) => void; onReportDeck: (deck: GeneratedDeckSummary) => void; generatedDecks: GeneratedDeckSummary[]; generatedError?: string; favorites: string[]; onFavorite: (modelId: string) => void; completedQuizIds: string[]; flashcardProgressByDeck: Record<string, FlashcardDeckProgress>; currentModelId: string }

export function LibraryView({ onOpen, onAssessment, onFlashcards, onGenerate, onGeneratedDeck, onUnlockDeck, onReportDeck, generatedDecks, generatedError, favorites, onFavorite, completedQuizIds, flashcardProgressByDeck, currentModelId }: LibraryProps) {
  const [query, setQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all')
  const [systemFilter, setSystemFilter] = useState('all')
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all')
  const filtered = useMemo(() => models.filter((model) => {
    const assessment = assessmentProgressForModel(model.id, completedQuizIds)
    const deck = flashcardDeckForModel(model.id)!
    const cards = flashcardProgress(deck, flashcardProgressByDeck[deck.id]?.cards)
    const matchesProgress = progressFilter === 'all'
      || (contentFilter === 'assessments' && assessment.status === progressFilter)
      || (contentFilter === 'flashcards' && cards.status === progressFilter)
      || (contentFilter === 'all' && (assessment.status === progressFilter || cards.status === progressFilter))
    return (!favoritesOnly || favorites.includes(model.id))
      && (systemFilter === 'all' || model.system === systemFilter)
      && matchesProgress
      && `${model.name} ${model.system} ${model.description} assessment flashcards foundations`.toLowerCase().includes(query.trim().toLowerCase())
  }), [completedQuizIds, contentFilter, favorites, favoritesOnly, flashcardProgressByDeck, progressFilter, query, systemFilter])
  const grouped = filtered.reduce<Record<string, ModelEntry[]>>((result, model) => {
    result[model.system] = [...(result[model.system] ?? []), model]
    return result
  }, {})
  const generatedVisible = generatedDecks.filter((deck) => {
    const model = models.find((entry) => entry.id === deck.modelId)
    return (contentFilter === 'all' || contentFilter === 'flashcards') && Boolean(model) && (systemFilter === 'all' || model?.system === systemFilter) && (!favoritesOnly || favorites.includes(deck.modelId)) && `${deck.title} ${deck.description} ${model?.name}`.toLowerCase().includes(query.trim().toLowerCase())
  })
  const renderGenerated = (deck: GeneratedDeckSummary) => {
    const progress = deck.cards ? flashcardProgress({ ...deck, cards: deck.cards }, flashcardProgressByDeck[deck.id]?.cards) : undefined
    return <article key={deck.id} className="library-card generated-deck-card"><div><div className="card-kicker"><span className="model-index"><GalleryVerticalEnd size={13} />AI deck · {deck.visibility}</span><span className={`progress-status ${progress?.status ?? 'locked'}`}>{deck.owner ? 'yours' : deck.unlocked ? progress?.status.replace('-', ' ') : 'locked'}</span></div><h3>{deck.title}</h3><em>12 AI-generated cards</em><p>{deck.description}</p>{progress && <i className="library-progress"><b style={{ width: `${(progress.reviewed / progress.total) * 100}%` }} /></i>}</div><footer><span>{deck.owner ? deck.visibility : deck.unlocked ? `${progress?.reviewed ?? 0} reviewed` : 'Unlock once'}</span><div>{!deck.owner && <button onClick={() => onReportDeck(deck)}>Report</button>}{deck.owner || deck.unlocked ? <button onClick={() => onGeneratedDeck(deck)}>Study<ArrowRight size={15} /></button> : <button onClick={() => onUnlockDeck(deck)}>Unlock · 5 credits<ArrowRight size={15} /></button>}</div></footer></article>
  }

  return <section className="content-view anim">
    <div className="view-title library-title"><div><span className="eyebrow">Learning library</span><h1>Models, assessments, and decks.</h1><p>Explore anatomy, measure retained knowledge, or review free verified flashcards with optional 3D context.</p></div><div className="library-filters"><label className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Library" /></label><div className="library-filter-row content-types" role="group" aria-label="Content type">{(['all', 'models', 'assessments', 'flashcards'] as ContentFilter[]).map((filter) => <button key={filter} className={contentFilter === filter ? 'active' : ''} onClick={() => setContentFilter(filter)}>{filter}</button>)}</div><div className="library-filter-row"><label>System<select value={systemFilter} onChange={(event) => setSystemFilter(event.target.value)}><option value="all">All systems</option>{systems.map((system) => <option key={system}>{system}</option>)}</select></label><label>Progress<select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value as ProgressFilter)}><option value="all">All progress</option><option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="complete">Complete</option></select></label></div><button className={favoritesOnly ? 'active' : ''} onClick={() => setFavoritesOnly((value) => !value)} aria-pressed={favoritesOnly}><Star size={15} />Favorite models · {favorites.length}</button></div></div>
    {generatedError && <p className="auth-error" role="alert">{generatedError}</p>}
    {filtered.length === 0 && generatedVisible.length === 0 && <div className="empty-state">No Library content matches these filters.</div>}
    {generatedVisible.some((deck) => deck.owner) && <div className="library-group generated-library-group"><h2>My generated decks<span>{generatedVisible.filter((deck) => deck.owner).length}</span></h2><div className="library-grid">{generatedVisible.filter((deck) => deck.owner).map(renderGenerated)}</div></div>}
    {generatedVisible.some((deck) => !deck.owner) && <div className="library-group generated-library-group"><h2>Community decks<span>{generatedVisible.filter((deck) => !deck.owner).length}</span></h2><div className="library-grid">{generatedVisible.filter((deck) => !deck.owner).map(renderGenerated)}</div></div>}
    {Object.entries(grouped).map(([system, entries]) => entries && <div className="library-group" key={system}><h2>{system}<span>{entries.length} {entries.length === 1 ? 'model' : 'models'}</span></h2><div className="library-grid">{entries.flatMap((model) => {
      const progress = assessmentProgressForModel(model.id, completedQuizIds)
      const deck = flashcardDeckForModel(model.id)!
      const deckProgress = flashcardProgress(deck, flashcardProgressByDeck[deck.id]?.cards)
      const cards = []
      if (contentFilter === 'all' || contentFilter === 'models') cards.push(<article key={`${model.id}-model`} className={`library-card ${model.id === currentModelId ? 'current' : ''}`}><div><div className="card-kicker"><span className="model-index">Model · {model.variants.length} {model.variants.length === 1 ? 'specimen' : 'specimens'}</span><button className={`favorite-button ${favorites.includes(model.id) ? 'active' : ''}`} onClick={() => onFavorite(model.id)} aria-label={`${favorites.includes(model.id) ? 'Remove' : 'Add'} ${model.name} favorite`} aria-pressed={favorites.includes(model.id)}><Star size={16} fill={favorites.includes(model.id) ? 'currentColor' : 'none'} /></button></div><h3>{model.name}</h3><em>{model.scientificName}</em><p>{model.description}</p></div><footer><span>{model.id === currentModelId ? 'Current study' : model.metadata.focus}</span><button onClick={() => onOpen(model)}>Explore<ArrowRight size={15} /></button></footer></article>)
      if (contentFilter === 'all' || contentFilter === 'assessments') cards.push(<article key={`${model.id}-assessment`} className="library-card assessment-card"><div><div className="card-kicker"><span className="model-index"><ClipboardList size={13} />Default assessment</span><span className={`progress-status ${progress.status}`}>{progress.status.replace('-', ' ')}</span></div><h3>{model.name} assessment</h3><em>20 verified questions</em><p>Test structure identification, function, and anatomical relationships for this model.</p><i className="library-progress"><b style={{ width: `${(progress.completed / progress.total) * 100}%` }} /></i></div><footer><span>{progress.completed} of {progress.total} correct</span><button onClick={() => onAssessment(model)}>{progress.completed > 0 ? 'Continue' : 'Start'}<ArrowRight size={15} /></button></footer></article>)
      if (contentFilter === 'all' || contentFilter === 'flashcards') cards.push(<article key={`${model.id}-flashcards`} className="library-card flashcard-deck-card"><div><div className="card-kicker"><span className="model-index"><GalleryVerticalEnd size={13} />Default flashcards</span><span className={`progress-status ${deckProgress.status}`}>{deckProgress.status.replace('-', ' ')}</span></div><h3>{deck.title}</h3><em>{deck.cards.length} verified cards · free</em><p>{deck.description}</p><i className="library-progress"><b style={{ width: `${(deckProgress.reviewed / deckProgress.total) * 100}%` }} /></i></div><footer><span>{deckProgress.reviewed} of {deckProgress.total} reviewed</span><div><button onClick={() => onGenerate(model)}>Generate new</button><button onClick={() => onFlashcards(deck)}>{deckProgress.reviewed > 0 ? 'Continue' : 'Study'}<ArrowRight size={15} /></button></div></footer></article>)
      return cards
    })}</div></div>)}
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
  onBack: () => void
}

export function QuizzesView({ model, quizzes, quizIndex, answers, submitted, hints, corrections, loadingHintIndex, loadingCorrections, onQuiz, onAnswer, onSubmit, onHint, onNewAssessment, onCorrections, generatingAssessment, aiError, aiNeedsCredits, signedIn, creditBalance, onBack }: QuizProps) {
  const quiz = quizzes[quizIndex]
  if (!quiz) return null
  const answeredCount = Object.keys(answers).length
  const selectedAnswer = answers[quizIndex]
  const score = submitted ? quizzes.reduce((total, entry, index) => total + (answers[index] === entry.correctIndex ? 1 : 0), 0) : 0
  const percentage = Math.round((score / quizzes.length) * 100)
  const correction = corrections?.[quizIndex]
  const balanceLabel = creditBalance === undefined ? 'Loading credits' : `${creditBalance} credits available`

  return <section className="content-view quiz-view assessment-view anim">
    <button className="library-back" onClick={onBack}><ArrowLeft size={14} />Back to Library</button><div className="view-title assessment-title">
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

import { lazy, Suspense, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, ClipboardList, GalleryVerticalEnd, Lightbulb, Search } from 'lucide-react'
import { models } from '../data/models'
import { assessmentProgressForModel } from '../data/quizzes'
import { flashcardDeckForModel, flashcardProgress } from '../data/flashcards'
import type { FlashcardDeck, FlashcardDeckProgress, GeneratedDeckSummary, ModelEntry, Quiz } from '../types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { ActiveNoteContext, LibraryContentMode, MaterialSubject } from '../types/materials'
import type { MaterialLearningController, MaterialLearningState } from '../types/materials'
import type { CreditBalance } from '../lib/ai'

const MaterialsView = lazy(() => import('./MaterialsView'))

type ProgressFilter = 'all' | 'not-started' | 'in-progress' | 'complete'
type LibraryProps = { onAssessment: (model: ModelEntry) => void; onFlashcards: (deck: FlashcardDeck) => void; onGeneratedDeck: (deck: GeneratedDeckSummary) => void; onUnlockDeck: (deck: GeneratedDeckSummary) => void; onReportDeck: (deck: GeneratedDeckSummary) => void; onMaterialGrade: (subject: MaterialSubject, cardId: string, grade: import('../types').FlashcardGrade) => void; onModeChange: (mode: LibraryContentMode) => void; onNoteContext: (context?: ActiveNoteContext) => void; onNoteRequest: (prompt: string) => void; onMaterialLearningState: (state?: MaterialLearningState) => void; onMaterialLearningController: (controller?: MaterialLearningController) => void; onBalance: (balance: CreditBalance) => void; onInsufficientCredits: (action: string, required: number) => void; onSignIn: () => void; signedIn: boolean; creditBalance?: number; generatedDecks: GeneratedDeckSummary[]; generatedError?: string; completedQuizIds: string[]; flashcardProgressByDeck: Record<string, FlashcardDeckProgress> }

export function LibraryView({ onAssessment, onFlashcards, onMaterialGrade, onModeChange, onNoteContext, onNoteRequest, onMaterialLearningState, onMaterialLearningController, onBalance, onInsufficientCredits, onSignIn, signedIn, creditBalance, completedQuizIds, flashcardProgressByDeck }: LibraryProps) {
  const [query, setQuery] = useState('')
  const [contentFilter, setContentFilter] = useState<LibraryContentMode>(() => { const content = new URLSearchParams(window.location.search).get('content'); return content === 'practice' || content === 'tests' ? 'practice' : content === 'flashcards' ? 'flashcards' : 'notes' })
  const [subjectOpen, setSubjectOpen] = useState(() => new URLSearchParams(window.location.search).has('subject'))
  const [modelFilter, setModelFilter] = useState('all')
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all')
  const filtered = useMemo(() => models.filter((model) => {
    const assessment = assessmentProgressForModel(model.id, completedQuizIds)
    const deck = flashcardDeckForModel(model.id)!
    const cards = flashcardProgress(deck, flashcardProgressByDeck[deck.id])
    const matchesProgress = progressFilter === 'all'
      || (contentFilter === 'practice' && assessment.status === progressFilter)
      || (contentFilter === 'flashcards' && cards.status === progressFilter)
    return contentFilter !== 'notes' && (modelFilter === 'all' || model.id === modelFilter)
      && matchesProgress
      && `${model.name} ${model.system} ${model.description} assessment flashcards foundations`.toLowerCase().includes(query.trim().toLowerCase())
  }), [completedQuizIds, contentFilter, flashcardProgressByDeck, modelFilter, progressFilter, query])
  function changeMode(mode: LibraryContentMode) {
    setContentFilter(mode)
    onModeChange(mode)
    const url = new URL(window.location.href)
    url.searchParams.set('content', mode)
    window.history.replaceState({}, '', url)
  }

  return <section className="content-view library-view learn-redesign anim" aria-labelledby="learn-heading">
    <header className="library-hero"><div><span className="page-kicker">Study collection</span><h1 id="learn-heading">Learn</h1><p>Read the notes, drill recall with flashcards, or sit a verified practice test, one subject at a time. Everything here is free; credits only power the AI.</p></div><Tabs value={contentFilter} onValueChange={(value) => changeMode(value as LibraryContentMode)}><TabsList className="library-primary-tabs" aria-label="Learning format"><TabsTrigger value="notes"><BookOpen />Notes</TabsTrigger><TabsTrigger value="flashcards"><GalleryVerticalEnd />Flashcards</TabsTrigger><TabsTrigger value="practice"><ClipboardList />Practice</TabsTrigger></TabsList></Tabs></header>
    <Suspense fallback={<div className="materials-state" role="status">Loading subjects...</div>}><MaterialsView mode={contentFilter} progressByDeck={flashcardProgressByDeck} onGrade={onMaterialGrade} onSubjectChange={(subject) => setSubjectOpen(Boolean(subject))} onNoteContext={onNoteContext} onNoteRequest={onNoteRequest} signedIn={signedIn} creditBalance={creditBalance} onBalance={onBalance} onInsufficientCredits={onInsufficientCredits} onSignIn={onSignIn} onLearningState={onMaterialLearningState} onLearningController={onMaterialLearningController} /></Suspense>
    {!subjectOpen && contentFilter !== 'notes' && <section className="library-secondary-content" aria-label={contentFilter === 'flashcards' ? 'Additional flashcard decks' : 'Additional practice tests'}>
    <div className="library-toolbar"><label className="library-search"><span className="sr-only">Search {contentFilter === 'flashcards' ? 'flashcard sets' : 'practice tests'}</span><Search aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${contentFilter === 'flashcards' ? 'flashcard sets' : 'practice tests'}`} /></label><div><label>Progress<select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value as ProgressFilter)}><option value="all">All progress</option><option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="complete">Complete</option></select></label></div></div>
    <section className="library-systems"><header><div><span className="page-kicker">Additional anatomy resources</span><h2>Browse anatomy models</h2></div><Button variant="ghost" size="sm" onClick={() => setModelFilter('all')}>All models</Button></header><div className="model-filter-list">{models.map((model) => <button key={model.id} className={modelFilter === model.id ? 'active' : ''} onClick={() => setModelFilter(modelFilter === model.id ? 'all' : model.id)}>{model.name}</button>)}</div></section>
    {filtered.length === 0 && <div className="empty-state">No Learn content matches these filters.</div>}
    <div className="library-collection-heading"><div><h2>{contentFilter === 'flashcards' ? 'Flashcard sets' : 'Practice tests'}</h2></div></div>
    {contentFilter === 'flashcards' ? <div className="library-resource-grid">{filtered.map((model) => {
      const deck = flashcardDeckForModel(model.id)!
      const deckProgress = flashcardProgress(deck, flashcardProgressByDeck[deck.id])
      return <Card key={`${model.id}-flashcards`} className="library-resource-card flashcard-deck-card"><header><span className="resource-icon deck" aria-hidden="true"><GalleryVerticalEnd /></span><span className="resource-status">{deck.cards.length} cards</span></header><div className="resource-card-copy"><h3>{deck.title}</h3><p>{model.system} anatomy</p></div><Progress value={(deckProgress.reviewed / deckProgress.total) * 100} aria-label={`${deckProgress.reviewed} of ${deckProgress.total} cards reviewed`} /><footer><span>{deckProgress.reviewed} of {deckProgress.total} reviewed</span><Button size="sm" onClick={() => onFlashcards(deck)}>{deckProgress.reviewed > 0 ? 'Continue' : 'Study'}<ArrowRight /></Button></footer></Card>
    })}</div> : <div className="practice-test-list">{filtered.map((model) => {
      const progress = assessmentProgressForModel(model.id, completedQuizIds)
      return <article key={`${model.id}-assessment`}><span className="resource-icon test" aria-hidden="true"><ClipboardList /></span><div><h3>{model.name} practice test</h3><p>{progress.total} verified questions</p></div><div className="practice-test-progress"><Progress value={(progress.completed / progress.total) * 100} aria-label={`${progress.completed} of ${progress.total} complete`} /><span>{progress.completed}/{progress.total} complete</span></div><Button variant="outline" onClick={() => onAssessment(model)} aria-label={`${progress.completed > 0 ? 'Resume' : 'Start'} ${model.name} practice test`}>{progress.completed > 0 ? 'Resume' : 'Start'}<ArrowRight /></Button></article>
    })}</div>}</section>}
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

export function QuizzesView({ model, quizzes, quizIndex, answers, submitted, hints, corrections, loadingHintIndex, loadingCorrections, onQuiz, onAnswer, onSubmit, onHint, onCorrections, aiError, aiNeedsCredits, signedIn, creditBalance, onBack }: QuizProps) {
  const quiz = quizzes[quizIndex]
  if (!quiz) return null
  const answeredCount = Object.keys(answers).length
  const selectedAnswer = answers[quizIndex]
  const score = submitted ? quizzes.reduce((total, entry, index) => total + (answers[index] === entry.correctIndex ? 1 : 0), 0) : 0
  const percentage = Math.round((score / quizzes.length) * 100)
  const correction = corrections?.[quizIndex]
  const balanceLabel = creditBalance === undefined ? 'Loading credits' : `${creditBalance} credits available`

  return <section className="content-view quiz-view assessment-view learn-redesign anim" aria-labelledby="assessment-heading">
    <header className="assessment-page-header"><Button variant="ghost" className="library-back" onClick={onBack}><ArrowLeft />All practice tests</Button><div><span className="page-kicker">Practice test</span><h1 id="assessment-heading">{model.name} assessment</h1><p>{quizzes.length} verified questions. Answer every question, then submit the complete attempt for grading.</p></div></header>
    {aiError && !aiNeedsCredits && <div className="ai-action-error"><span>{aiError}</span></div>}
    {submitted && !corrections ? <section className="assessment-result" aria-live="polite"><div><span>Assessment submitted</span><strong>{percentage}%</strong><p>{score} of {quizzes.length} questions correct</p></div><div><h2>{percentage >= 70 ? 'Strong result.' : 'Keep building.'}</h2><p>Your score is final for this attempt. Unlock detailed AI corrections to review every answer.</p><small>{signedIn ? balanceLabel : 'Sign in to use AI assessment tools.'}</small><div><Button variant="ai" onClick={onCorrections} disabled={loadingCorrections}>{loadingCorrections ? 'Preparing corrections...' : signedIn ? 'See AI corrections · 2 credits' : 'Sign in for corrections'}</Button></div></div></section> : <div className="assessment-workspace">
      <Card className="assessment-navigator"><header><div><span>Progress</span><strong>{answeredCount}/{quizzes.length}</strong></div><Progress value={(answeredCount / quizzes.length) * 100} /></header><div className="assessment-question-grid" aria-label="Assessment questions">{quizzes.map((entry, index) => <button key={entry.id} className={`${index === quizIndex ? 'active' : ''} ${answers[index] !== undefined ? 'complete' : ''}`} onClick={() => onQuiz(index)} aria-label={`Question ${index + 1}${answers[index] !== undefined ? ', answered' : ', unanswered'}`} aria-current={index === quizIndex ? 'step' : undefined}>{index + 1}</button>)}</div><footer><span><i className="answered" />Answered</span><span><i className="current" />Current</span></footer></Card>
      <Card className="quiz-stage assessment-stage"><header><div><span className="question-number">{quizIndex + 1}</span><strong>Question {quizIndex + 1} of {quizzes.length}</strong></div><div>{!submitted && <Button variant="ghost" size="sm" className="hint-button" onClick={() => onHint(quizIndex)} disabled={loadingHintIndex !== undefined || Boolean(hints[quizIndex])}><Lightbulb />{hints[quizIndex] ? 'Hint unlocked' : loadingHintIndex === quizIndex ? 'Generating...' : signedIn ? 'Hint · 1 credit' : 'Sign in for hint'}</Button>}</div></header><div className="assessment-question-copy"><Badge variant="outline">Multiple choice</Badge><h2>{quiz.question}</h2></div><fieldset disabled={submitted}>{quiz.options.map((option, index) => { const correct = Boolean(corrections) && index === quiz.correctIndex; const selected = selectedAnswer === index; return <label key={option} className={`${selected ? 'selected' : ''} ${corrections ? `${correct ? 'correction-correct' : ''} ${selected && !correct ? 'correction-selected' : ''}` : ''}`}><input type="radio" name={`quiz-${quiz.id}`} value={index} checked={selected} onChange={() => onAnswer(index)} /><span>{String.fromCharCode(65 + index)}</span><b>{option}</b>{corrections && correct && <Check />}</label> })}</fieldset>{hints[quizIndex] && <div className="assessment-hint"><Lightbulb /><div><strong>Hint</strong><p>{hints[quizIndex]}</p></div></div>}{correction && <div className="assessment-correction"><span>AI correction</span><h3>{selectedAnswer === quiz.correctIndex ? 'Your answer was correct.' : `Correct answer: ${quiz.options[quiz.correctIndex]}`}</h3><p>{correction}</p></div>}<footer><Button variant="ghost" onClick={() => onQuiz(quizIndex - 1)} disabled={quizIndex === 0}><ArrowLeft />Previous</Button><span>{answeredCount} answered</span><div>{quizIndex < quizzes.length - 1 && <Button onClick={() => onQuiz(quizIndex + 1)}>Next<ArrowRight /></Button>}{!submitted && answeredCount === quizzes.length && <Button onClick={onSubmit}>Submit test</Button>}</div></footer></Card>
    </div>}
  </section>
}

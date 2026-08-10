import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, ClipboardList, GalleryVerticalEnd, Lightbulb, Search, Sparkles } from 'lucide-react'
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

type ContentFilter = 'assessments' | 'flashcards'
type ProgressFilter = 'all' | 'not-started' | 'in-progress' | 'complete'
type LibraryProps = { onAssessment: (model: ModelEntry) => void; onFlashcards: (deck: FlashcardDeck) => void; onGenerate: (model: ModelEntry) => void; onGeneratedDeck: (deck: GeneratedDeckSummary) => void; onUnlockDeck: (deck: GeneratedDeckSummary) => void; onReportDeck: (deck: GeneratedDeckSummary) => void; generatedDecks: GeneratedDeckSummary[]; generatedError?: string; completedQuizIds: string[]; flashcardProgressByDeck: Record<string, FlashcardDeckProgress> }

export function LibraryView({ onAssessment, onFlashcards, onGenerate, onGeneratedDeck, onUnlockDeck, onReportDeck, generatedDecks, generatedError, completedQuizIds, flashcardProgressByDeck }: LibraryProps) {
  const [query, setQuery] = useState('')
  const [contentFilter, setContentFilter] = useState<ContentFilter>(() => new URLSearchParams(window.location.search).get('content') === 'tests' ? 'assessments' : 'flashcards')
  const [modelFilter, setModelFilter] = useState('all')
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all')
  const filtered = useMemo(() => models.filter((model) => {
    const assessment = assessmentProgressForModel(model.id, completedQuizIds)
    const deck = flashcardDeckForModel(model.id)!
    const cards = flashcardProgress(deck, flashcardProgressByDeck[deck.id]?.cards)
    const matchesProgress = progressFilter === 'all'
      || (contentFilter === 'assessments' && assessment.status === progressFilter)
      || (contentFilter === 'flashcards' && cards.status === progressFilter)
    return (modelFilter === 'all' || model.id === modelFilter)
      && matchesProgress
      && `${model.name} ${model.system} ${model.description} assessment flashcards foundations`.toLowerCase().includes(query.trim().toLowerCase())
  }), [completedQuizIds, contentFilter, flashcardProgressByDeck, modelFilter, progressFilter, query])
  const generatedVisible = generatedDecks.filter((deck) => {
    const model = models.find((entry) => entry.id === deck.modelId)
    return contentFilter === 'flashcards' && Boolean(model) && (modelFilter === 'all' || deck.modelId === modelFilter) && `${deck.title} ${model?.name}`.toLowerCase().includes(query.trim().toLowerCase())
  })
  const renderGenerated = (deck: GeneratedDeckSummary) => {
    const progress = deck.cards ? flashcardProgress({ ...deck, cards: deck.cards }, flashcardProgressByDeck[deck.id]?.cards) : undefined
    return <Card key={deck.id} className="library-resource-card generated-deck-card"><header><span className="resource-icon ai"><Sparkles /></span><Badge variant="secondary">AI deck</Badge><span className={`resource-status ${progress?.status ?? 'locked'}`}>{deck.owner ? 'Yours' : deck.unlocked ? progress?.status.replace('-', ' ') : 'Locked'}</span></header><div className="resource-card-copy"><h3>{deck.title}</h3></div>{progress && <Progress value={(progress.reviewed / progress.total) * 100} />}<footer><span>{deck.owner ? deck.visibility : deck.unlocked ? `${progress?.reviewed ?? 0} of ${progress?.total ?? 15} reviewed` : 'Unlock once'}</span><div>{!deck.owner && <Button variant="ghost" size="sm" onClick={() => onReportDeck(deck)}>Report</Button>}{deck.owner || deck.unlocked ? <Button size="sm" onClick={() => onGeneratedDeck(deck)}>Study<ArrowRight /></Button> : <Button size="sm" onClick={() => onUnlockDeck(deck)}>Unlock · 5 credits</Button>}</div></footer></Card>
  }

  return <section className="content-view library-view anim">
    <header className="library-hero"><div><span className="page-kicker">Study collection</span><h1>Your library</h1><p>Build recall with focused anatomy flashcards or sit a verified practice test.</p></div><Tabs value={contentFilter} onValueChange={(value) => setContentFilter(value as ContentFilter)}><TabsList className="library-primary-tabs"><TabsTrigger value="flashcards"><GalleryVerticalEnd />Flashcard sets</TabsTrigger><TabsTrigger value="assessments"><ClipboardList />Practice tests</TabsTrigger></TabsList></Tabs></header>
    <div className="library-toolbar"><label className="library-search"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${contentFilter === 'flashcards' ? 'flashcards' : 'practice tests'}`} /></label><div><label>Progress<select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value as ProgressFilter)}><option value="all">All progress</option><option value="not-started">Not started</option><option value="in-progress">In progress</option><option value="complete">Complete</option></select></label></div></div>
    <section className="library-systems"><header><div><h2>Browse anatomy</h2></div><Button variant="ghost" size="sm" onClick={() => setModelFilter('all')}>All models</Button></header><div className="model-filter-list">{models.map((model) => <button key={model.id} className={modelFilter === model.id ? 'active' : ''} onClick={() => setModelFilter(modelFilter === model.id ? 'all' : model.id)}>{model.name}</button>)}</div></section>
    {generatedError && <p className="auth-error" role="alert">{generatedError}</p>}
    {filtered.length === 0 && generatedVisible.length === 0 && <div className="empty-state">No Library content matches these filters.</div>}
    {generatedVisible.some((deck) => deck.owner) && <div className="library-group generated-library-group"><h2>My generated decks<span>{generatedVisible.filter((deck) => deck.owner).length}</span></h2><div className="library-resource-grid">{generatedVisible.filter((deck) => deck.owner).map(renderGenerated)}</div></div>}
    {generatedVisible.some((deck) => !deck.owner) && <div className="library-group generated-library-group"><h2>Community decks<span>{generatedVisible.filter((deck) => !deck.owner).length}</span></h2><div className="library-resource-grid">{generatedVisible.filter((deck) => !deck.owner).map(renderGenerated)}</div></div>}
    <div className="library-collection-heading"><div><h2>{contentFilter === 'flashcards' ? 'Flashcard sets' : 'Practice tests'}</h2><p>{filtered.length} models available</p></div></div>
    {contentFilter === 'flashcards' ? <div className="library-resource-grid">{filtered.map((model) => {
      const deck = flashcardDeckForModel(model.id)!
      const deckProgress = flashcardProgress(deck, flashcardProgressByDeck[deck.id]?.cards)
      return <Card key={`${model.id}-flashcards`} className="library-resource-card flashcard-deck-card"><header><span className="resource-icon deck"><GalleryVerticalEnd /></span><Badge variant="outline">{deck.cards.length} cards</Badge><span className={`resource-status ${deckProgress.status}`}>{deckProgress.status.replace('-', ' ')}</span></header><div className="resource-card-copy"><h3>{deck.title}</h3></div><Progress value={(deckProgress.reviewed / deckProgress.total) * 100} /><footer><span>{deckProgress.reviewed} of {deckProgress.total} reviewed</span><div><Button variant="ghost" size="sm" onClick={() => onGenerate(model)}>Generate</Button><Button size="sm" onClick={() => onFlashcards(deck)}>{deckProgress.reviewed > 0 ? 'Continue' : 'Study'}<ArrowRight /></Button></div></footer></Card>
    })}</div> : <div className="practice-test-list">{filtered.map((model) => {
      const progress = assessmentProgressForModel(model.id, completedQuizIds)
      return <article key={`${model.id}-assessment`}><span className="resource-icon test"><ClipboardList /></span><div><h3>{model.name} practice test</h3><p>20 verified questions</p></div><div className="practice-test-progress"><Progress value={(progress.completed / progress.total) * 100} /><span>{progress.completed}/{progress.total} complete</span></div><Button variant="outline" onClick={() => onAssessment(model)}>{progress.completed > 0 ? 'Resume' : 'Start'}<ArrowRight /></Button></article>
    })}</div>}
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
    <header className="assessment-page-header"><Button variant="ghost" className="library-back" onClick={onBack}><ArrowLeft />Library</Button><div><span className="page-kicker">Practice test</span><h1>{model.name} assessment</h1><p>Answer every question, then submit the complete attempt for grading.</p></div><Badge variant="secondary"><BookOpenCheck />20 verified questions</Badge></header>
    {aiError && !aiNeedsCredits && <div className="ai-action-error"><span>{aiError}</span></div>}
    {submitted && !corrections ? <section className="assessment-result" aria-live="polite"><div><span>Assessment submitted</span><strong>{percentage}%</strong><p>{score} of {quizzes.length} questions correct</p></div><div><h2>{percentage >= 70 ? 'Strong result.' : 'Keep building.'}</h2><p>Your score is final for this attempt. Unlock detailed AI corrections to review every answer.</p><small>{signedIn ? balanceLabel : 'Sign in to use AI assessment tools.'}</small><div><Button onClick={onCorrections} disabled={loadingCorrections}>{loadingCorrections ? 'Preparing corrections...' : signedIn ? 'See AI corrections · 2 credits' : 'Sign in for corrections'}</Button><Button variant="outline" onClick={onNewAssessment} disabled={generatingAssessment}>{generatingAssessment ? 'Generating assessment...' : signedIn ? 'New assessment · 5 credits' : 'Sign in for new assessment'}</Button></div></div></section> : <div className="assessment-workspace">
      <Card className="assessment-navigator"><header><div><span>Progress</span><strong>{answeredCount}/{quizzes.length}</strong></div><Progress value={(answeredCount / quizzes.length) * 100} /></header><div className="assessment-question-grid" aria-label="Assessment questions">{quizzes.map((entry, index) => <button key={entry.id} className={`${index === quizIndex ? 'active' : ''} ${answers[index] !== undefined ? 'complete' : ''}`} onClick={() => onQuiz(index)} aria-label={`Question ${index + 1}${answers[index] !== undefined ? ', answered' : ', unanswered'}`} aria-current={index === quizIndex ? 'step' : undefined}>{index + 1}</button>)}</div><footer><span><i className="answered" />Answered</span><span><i className="current" />Current</span></footer></Card>
      <Card className="quiz-stage assessment-stage"><header><div><span className="question-number">{quizIndex + 1}</span><strong>Question {quizIndex + 1} of {quizzes.length}</strong></div><div>{!submitted && <Button variant="ghost" size="sm" className="hint-button" onClick={() => onHint(quizIndex)} disabled={loadingHintIndex !== undefined || Boolean(hints[quizIndex])}><Lightbulb />{hints[quizIndex] ? 'Hint unlocked' : loadingHintIndex === quizIndex ? 'Generating...' : signedIn ? 'Hint · 1 credit' : 'Sign in for hint'}</Button>}</div></header><div className="assessment-question-copy"><Badge variant="outline">Multiple choice</Badge><h2>{quiz.question}</h2></div><fieldset disabled={submitted}>{quiz.options.map((option, index) => { const correct = Boolean(corrections) && index === quiz.correctIndex; const selected = selectedAnswer === index; return <label key={option} className={`${selected ? 'selected' : ''} ${corrections ? `${correct ? 'correction-correct' : ''} ${selected && !correct ? 'correction-selected' : ''}` : ''}`}><input type="radio" name={`quiz-${quiz.id}`} value={index} checked={selected} onChange={() => onAnswer(index)} /><span>{String.fromCharCode(65 + index)}</span><b>{option}</b>{corrections && correct && <Check />}</label> })}</fieldset>{hints[quizIndex] && <div className="assessment-hint"><Lightbulb /><div><strong>Hint</strong><p>{hints[quizIndex]}</p></div></div>}{correction && <div className="assessment-correction"><span>AI correction</span><h3>{selectedAnswer === quiz.correctIndex ? 'Your answer was correct.' : `Correct answer: ${quiz.options[quiz.correctIndex]}`}</h3><p>{correction}</p></div>}<footer><Button variant="ghost" onClick={() => onQuiz(quizIndex - 1)} disabled={quizIndex === 0}><ArrowLeft />Previous</Button><span>{answeredCount} answered</span><div>{quizIndex < quizzes.length - 1 && <Button onClick={() => onQuiz(quizIndex + 1)}>Next<ArrowRight /></Button>}{!submitted && answeredCount === quizzes.length && <Button onClick={onSubmit}>Submit test</Button>}</div></footer></Card>
    </div>}
  </section>
}

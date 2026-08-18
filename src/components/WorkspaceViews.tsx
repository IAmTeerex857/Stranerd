import { lazy, Suspense, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, ClipboardList, GalleryVerticalEnd, LayoutGrid, Lightbulb, Zap } from 'lucide-react'
import type { FlashcardDeck, FlashcardDeckProgress, GeneratedDeckSummary, MaterialReleaseProgress, ModelEntry, Quiz } from '../types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { ActiveNoteContext, LibraryContentMode, MaterialCatalogRegistration, MaterialSubject } from '../types/materials'
import type { MaterialLearningController, MaterialLearningState } from '../types/materials'
import type { CreditBalance } from '../lib/ai'

const MaterialsView = lazy(() => import('./MaterialsView'))

type LibraryProps = { mode: LibraryContentMode; onAssessment: (model: ModelEntry) => void; onFlashcards: (deck: FlashcardDeck) => void; onGeneratedDeck: (deck: GeneratedDeckSummary) => void; onUnlockDeck: (deck: GeneratedDeckSummary) => void; onReportDeck: (deck: GeneratedDeckSummary) => void; onMaterialGrade: (subject: MaterialSubject, cardId: string, grade: import('../types').FlashcardGrade) => void; onMaterialProgress: (subject: MaterialSubject, progress: Partial<MaterialReleaseProgress>) => void; onModeChange: (mode: LibraryContentMode) => void; onNoteContext: (context?: ActiveNoteContext) => void; onNoteRequest: (prompt: string) => void; onMaterialLearningState: (state?: MaterialLearningState) => void; onMaterialLearningController: (controller?: MaterialLearningController) => void; onMaterialCatalog: (registration?: MaterialCatalogRegistration) => void; onBalance: (balance: CreditBalance) => void; onInsufficientCredits: (action: string, required: number) => void; onSignIn: () => void; signedIn: boolean; creditBalance?: number; generatedDecks: GeneratedDeckSummary[]; generatedError?: string; completedQuizIds: string[]; flashcardProgressByDeck: Record<string, FlashcardDeckProgress>; materialProgressByRelease: Record<string, MaterialReleaseProgress> }

export function LibraryView({ mode, onMaterialGrade, onMaterialProgress, onModeChange, onNoteContext, onNoteRequest, onMaterialLearningState, onMaterialLearningController, onMaterialCatalog, onBalance, onInsufficientCredits, onSignIn, signedIn, creditBalance, flashcardProgressByDeck, materialProgressByRelease }: LibraryProps) {
  const [subjectOpen, setSubjectOpen] = useState(() => new URLSearchParams(window.location.search).has('subject'))
  function changeMode(mode: LibraryContentMode) {
    setSubjectOpen(false)
    onModeChange(mode)
    const url = new URL(window.location.href)
    url.searchParams.set('content', mode)
    window.history.replaceState({}, '', url)
  }

  return <section className={`content-view library-view learn-redesign anim ${subjectOpen ? 'subject-open' : ''}`} aria-labelledby="learn-heading">
    {!subjectOpen && <header className="library-hero"><div><span className="page-kicker">Study collection</span><h1 id="learn-heading">Learn</h1><p>Read the notes, drill recall with flashcards, or sit a verified practice test, one subject at a time. Everything here is free; credits only power the AI.</p></div><Tabs value={mode} onValueChange={(value) => changeMode(value as LibraryContentMode)}><TabsList className="library-primary-tabs" aria-label="Learning format"><TabsTrigger value="notes"><BookOpen />Notes</TabsTrigger><TabsTrigger value="flashcards"><GalleryVerticalEnd />Flashcards</TabsTrigger><TabsTrigger value="practice"><ClipboardList />Practice</TabsTrigger></TabsList></Tabs></header>}
    <Suspense fallback={<div className="materials-state" role="status">Loading subjects...</div>}><MaterialsView mode={mode} progressByDeck={flashcardProgressByDeck} materialProgressByRelease={materialProgressByRelease} onGrade={onMaterialGrade} onProgress={onMaterialProgress} onSubjectChange={(subject) => setSubjectOpen(Boolean(subject))} onNoteContext={onNoteContext} onNoteRequest={onNoteRequest} signedIn={signedIn} creditBalance={creditBalance} onBalance={onBalance} onInsufficientCredits={onInsufficientCredits} onSignIn={onSignIn} onLearningState={onMaterialLearningState} onLearningController={onMaterialLearningController} onCatalog={onMaterialCatalog} /></Suspense>
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
  onReviewing: (reviewing: boolean) => void
  generatingAssessment: boolean
  aiError?: string
  aiNeedsCredits: boolean
  signedIn: boolean
  creditBalance?: number
  onBack: () => void
}

export function QuizzesView({ model, quizzes, quizIndex, answers, submitted, hints, corrections, loadingHintIndex, loadingCorrections, onQuiz, onAnswer, onSubmit, onHint, onCorrections, onReviewing, aiError, aiNeedsCredits, signedIn, onBack }: QuizProps) {
  const [navOpen, setNavOpen] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const quiz = quizzes[quizIndex]
  if (!quiz) return null
  const answeredCount = Object.keys(answers).length
  const selectedAnswer = answers[quizIndex]
  const score = submitted ? quizzes.reduce((total, entry, index) => total + (answers[index] === entry.correctIndex ? 1 : 0), 0) : 0
  const percentage = Math.round((score / quizzes.length) * 100)
  const correction = corrections?.[quizIndex]

  return <section className="content-view quiz-view assessment-view learn-redesign anim" aria-labelledby="assessment-heading">
    <header className="assessment-page-header"><Button variant="ghost" className="library-back" onClick={onBack}><ArrowLeft />All practice tests</Button><div><span className="page-kicker">Practice test</span><h1 id="assessment-heading">{model.name} assessment</h1><p>{quizzes.length} verified questions. Answer every question, then submit the complete attempt for grading.</p></div></header>
    {aiError && !aiNeedsCredits && <div className="ai-action-error"><span>{aiError}</span></div>}
    {submitted && !corrections && !reviewing ? <section className="assessment-result" aria-live="polite"><div className="assessment-score"><div className="assessment-score-ring" style={{ background: `conic-gradient(var(--success) ${percentage}%, var(--learn-muted) 0)` }}><span><strong>{percentage}%</strong><small>{score} / {quizzes.length}</small></span></div></div><div className="assessment-result-copy"><h2>{percentage >= 70 ? 'Strong result.' : 'Keep building.'}</h2><p>You answered {score} of {quizzes.length} questions correctly.</p><div><Button variant="ai" onClick={onCorrections} disabled={loadingCorrections}><Zap />{loadingCorrections ? 'Preparing corrections...' : 'Unlock corrections · 2 credits'}</Button><Button variant="outline" onClick={() => { onQuiz(0); setReviewing(true); onReviewing(true) }}>Review answers</Button><Button className="assessment-back-button" onClick={onBack}>Back to tests</Button></div></div></section> : <div className="assessment-workspace">
      {navOpen && <button className="assessment-nav-backdrop" onClick={() => setNavOpen(false)} aria-label="Close question navigator" />}
      <Card className={`assessment-navigator ${navOpen ? 'mobile-open' : ''}`}><header><div><span>Progress</span><strong>{answeredCount}/{quizzes.length}</strong><b className="mobile-current-question">Q{quizIndex + 1} <em>/ {quizzes.length}</em></b></div><Button variant="outline" className="mobile-question-nav-trigger" onClick={() => setNavOpen(true)}><LayoutGrid />{answeredCount}/{quizzes.length}</Button><Progress value={(answeredCount / quizzes.length) * 100} /></header><div className="mobile-navigator-title"><i /><strong>Question navigator</strong><span>{answeredCount} of {quizzes.length} answered</span></div><div className="assessment-question-grid" aria-label="Assessment questions">{quizzes.map((entry, index) => <button key={entry.id} className={`${index === quizIndex ? 'active' : ''} ${answers[index] !== undefined ? 'complete' : ''}`} onClick={() => { onQuiz(index); setNavOpen(false) }} aria-label={`Question ${index + 1}${answers[index] !== undefined ? ', answered' : ', unanswered'}`} aria-current={index === quizIndex ? 'step' : undefined}>{index + 1}</button>)}</div><footer><span><i className="answered" />Answered</span><span><i className="current" />Current</span></footer></Card>
      <Card className="quiz-stage assessment-stage"><header><div><span className="question-number">{quizIndex + 1}</span><strong>Question {quizIndex + 1} of {quizzes.length}</strong></div><div>{!submitted && <Button variant="ghost" size="sm" className="hint-button desktop-assessment-hint" onClick={() => onHint(quizIndex)} disabled={loadingHintIndex !== undefined || Boolean(hints[quizIndex])}><Lightbulb />{hints[quizIndex] ? 'Hint unlocked' : loadingHintIndex === quizIndex ? 'Generating...' : signedIn ? 'Hint · 1 credit' : 'Sign in for hint'}</Button>}</div></header><div className="assessment-question-copy"><Badge variant="outline">Multiple choice</Badge><h2>{quiz.question}</h2></div><fieldset disabled={submitted}>{quiz.options.map((option, index) => { const correct = Boolean(corrections) && index === quiz.correctIndex; const selected = selectedAnswer === index; return <label key={option} className={`${selected ? 'selected' : ''} ${corrections ? `${correct ? 'correction-correct' : ''} ${selected && !correct ? 'correction-selected' : ''}` : ''}`}><input type="radio" name={`quiz-${quiz.id}`} value={index} checked={selected} onChange={() => onAnswer(index)} /><span>{String.fromCharCode(65 + index)}</span><b>{option}</b>{corrections && correct && <Check />}</label> })}</fieldset>{hints[quizIndex] && <div className="assessment-hint"><Lightbulb /><div><strong>Hint</strong><p>{hints[quizIndex]}</p></div></div>}{correction && <div className="assessment-correction"><span>AI correction</span><h3>{selectedAnswer === quiz.correctIndex ? 'Your answer was correct.' : `Correct answer: ${quiz.options[quiz.correctIndex]}`}</h3><p>{correction}</p></div>}<footer>{!submitted && <Button variant="ghost" className="mobile-assessment-hint" onClick={() => onHint(quizIndex)} disabled={loadingHintIndex !== undefined || Boolean(hints[quizIndex])} aria-label="Request hint"><Lightbulb /></Button>}<Button variant="ghost" onClick={() => onQuiz(quizIndex - 1)} disabled={quizIndex === 0}><ArrowLeft />Previous</Button><span>{answeredCount} answered</span><div>{quizIndex < quizzes.length - 1 && <Button onClick={() => onQuiz(quizIndex + 1)}>Next<ArrowRight /></Button>}{!submitted && answeredCount === quizzes.length && <Button onClick={onSubmit}>Submit test</Button>}</div></footer></Card>
    </div>}
  </section>
}

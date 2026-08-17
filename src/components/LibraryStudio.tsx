import { useEffect, useEffectEvent, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react'
import {
  AlertTriangle, ArrowLeft, ArrowRight, Check, ClipboardCheck,
  CirclePlay, File, FileCode2, FileText, Globe2, Layers3, Link as LinkIcon, LoaderCircle,
  LayoutGrid, Mic, MoreVertical, Pencil, Plus, RotateCcw, Save, ScanLine, Share2, Shuffle, Sparkles,
  Trash2, Type, Upload, X,
} from 'lucide-react'
import { useAuth } from '../auth-context'
import { AIActionError } from '../lib/ai'
import { shuffledIds } from '../lib/flashcards'
import { Button } from './ui/button'
import { Card } from './ui/card'
import { Progress } from './ui/progress'
import {
  bulkEditLibraryItems, createLibraryGeneration, createLibraryShare, deleteLibrarySet,
  getLibrarySet, gradeLibrarySet, listLibrary, removeLibraryInputs, renameLibrarySet, resetLibraryProgress, uploadLibraryInput, upsertLibraryProgress,
  type LibraryItem, type LibrarySet,
} from '../lib/library'
import {
  LIBRARY_AUDIO_MIME_TYPES, LIBRARY_DOCUMENT_MIME_TYPES, LIBRARY_MAX_FILE_BYTES,
  LIBRARY_MAX_SOURCES, libraryGenerationCost, type LibraryFileSource,
  type LibraryFlashcardContent, type LibraryItemContent, type LibraryOutputType, type LibraryPracticeContent, type LibrarySourceCategory,
} from '../../shared/library'
import { mergeLibraryProgress, type LibraryStudyProgress } from '../../shared/libraryProgress'
import type { VoiceAction, VoiceActionResult } from '../lib/voiceActions'
import { createCoalescingRunner, type CoalescingRunner } from '../lib/coalescingRunner'
import { loginPath } from '../auth-utils'
import '../library-redesign.css'

type SourceTab = 'prompt' | 'upload' | 'link'
type StagedLink = { id: string; url: string; category: 'link' | 'youtube' }
type StudySet = { id?: string; version?: number; title: string; outputType: LibraryOutputType; items: LibraryItem[] }
type PracticeGrade = { score: number; results: Array<{ id: string; correctIndex: number; explanation: string }> }
type EditorState = { set: LibrarySet; title: string; originalTitle: string; items: LibraryItem[]; originalItems: LibraryItem[]; deleted: string[] }
export type StudioVoiceState =
  | { target: 'studio-catalog'; sets: Array<{ id: string; title: string; type: LibraryOutputType }> }
  | { target: 'studio-flashcards'; deckId: string; cardId: string; index: number; count: number; side: 'question' | 'answer'; graded: boolean; question: { heading: string; body: string }; answer?: { heading: string; body: string } }
  | { target: 'studio-practice'; questionId: string; index: number; count: number; question: string; options: string[]; selectedIndex: number | null; submitted: boolean; phase: 'taking' | 'result' | 'review'; score?: number; correctAnswer?: string; explanation?: string }
export type StudioController = { openSet: (setId: string) => Promise<VoiceActionResult>; executeVoiceAction: (action: Extract<VoiceAction, { type: `assessment.${string}` | `flashcard.${string}` }>) => VoiceActionResult | Promise<VoiceActionResult> }

const promptIdeas = ['Cranial nerves and deficits', 'Acid-base balance', 'The cardiac cycle']
const youtubeHosts = new Set(['youtube.com', 'youtu.be'])
const pendingProgressKey = (userId: string) => `stranerd.library.pending-progress.v1:${userId}`

function loadPendingProgress(userId: string) {
  try { return JSON.parse(localStorage.getItem(pendingProgressKey(userId)) || '{}') as Record<string, LibraryStudyProgress> } catch { return {} }
}

function storePendingProgress(userId: string, progress?: LibraryStudyProgress) {
  const pending = loadPendingProgress(userId)
  if (progress) pending[progress.setId] = progress
  else return
  localStorage.setItem(pendingProgressKey(userId), JSON.stringify(pending))
}

function clearPendingProgress(userId: string, setId: string) {
  const pending = loadPendingProgress(userId)
  delete pending[setId]
  localStorage.setItem(pendingProgressKey(userId), JSON.stringify(pending))
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function balanceTotal(balance: ReturnType<typeof useAuth>['balance']) {
  return balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : 0
}

function isYoutube(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, '')
    return youtubeHosts.has(host) || host.endsWith('.youtube.com')
  } catch { return false }
}

function validHttpsUrl(value: string) {
  try { return new URL(value).protocol === 'https:' } catch { return false }
}

function suggestedTitle(tab: SourceTab, prompt: string, files: File[], links: StagedLink[]) {
  const raw = tab === 'prompt' ? prompt : tab === 'upload' ? files[0]?.name.replace(/\.[^.]+$/, '') : links[0] ? new URL(links[0].url).hostname.replace(/^www\./, '') : ''
  return raw.trim().replace(/\s+/g, ' ').slice(0, 160) || 'Untitled study set'
}

function relativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime()
  if (elapsed < 60_000) return 'Just now'
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

function contentIsFlashcard(content: LibraryItemContent): content is { front: string; back: string } {
  return 'front' in content
}

function AutoGrowTextarea({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  function resize(element: HTMLTextAreaElement | null) {
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }
  return <textarea ref={resize} value={value} rows={1} onInput={(event) => resize(event.currentTarget)} onChange={(event) => onChange(event.target.value)} />
}

export function LibraryStudyExperience({ set, onBack, readOnly = false, initialProgress, onProgress, onReset, onGrade, onVoiceState, onVoiceAction }: { set: StudySet; onBack: () => void; readOnly?: boolean; initialProgress?: LibraryStudyProgress; onProgress?: (progress: LibraryStudyProgress) => void; onReset?: () => Promise<LibraryStudyProgress>; onGrade?: (answers: Record<string, number>) => Promise<PracticeGrade>; onVoiceState?: (state: StudioVoiceState | undefined) => void; onVoiceAction?: (handler: StudioController['executeVoiceAction'] | undefined) => void }) {
  if (!set.items.length) return <EmptyStudy onBack={onBack} />
  return set.outputType === 'flashcards'
    ? <FlashcardStudy set={set} onBack={onBack} readOnly={readOnly} initialProgress={initialProgress} onProgress={onProgress} onVoiceState={onVoiceState} onVoiceAction={onVoiceAction} />
    : <PracticeStudy set={set} onBack={onBack} readOnly={readOnly} initialProgress={initialProgress} onProgress={onProgress} onReset={onReset} onGrade={onGrade} onVoiceState={onVoiceState} onVoiceAction={onVoiceAction} />
}

function newProgress(set: StudySet): LibraryStudyProgress {
  const now = new Date().toISOString()
  const base = { setId: set.id!, setVersion: set.version!, attemptId: crypto.randomUUID(), resetAt: now, index: { value: 0, updatedAt: now }, items: {} }
  return set.outputType === 'flashcards'
    ? { ...base, kind: 'flashcards', order: { value: set.items.map((item) => item.id), updatedAt: now }, side: { value: 'question', updatedAt: now } }
    : { ...base, kind: 'practice', submitted: { value: false, updatedAt: now }, reviewing: { value: false, updatedAt: now }, score: { value: null, updatedAt: now } }
}

function FlashcardStudy({ set, onBack, readOnly, initialProgress, onProgress, onVoiceState, onVoiceAction }: { set: StudySet; onBack: () => void; readOnly: boolean; initialProgress?: LibraryStudyProgress; onProgress?: (progress: LibraryStudyProgress) => void; onVoiceState?: (state: StudioVoiceState | undefined) => void; onVoiceAction?: (handler: StudioController['executeVoiceAction'] | undefined) => void }) {
  const cards = set.items.filter((item) => contentIsFlashcard(item.content))
  const initial = initialProgress ?? (set.id && set.version ? newProgress(set) : undefined)
  const progress = useRef(initial)
  const [order, setOrder] = useState(() => initial?.order?.value ?? cards.map((card) => card.id))
  const [index, setIndex] = useState(() => initial?.index.value ?? 0)
  const [flipped, setFlipped] = useState(() => initial?.side?.value === 'answer')
  const [reviewed, setReviewed] = useState<Set<string>>(() => new Set(Object.entries(initial?.items ?? {}).filter(([, item]) => item.reviewed).map(([id]) => id)))
  const [graded, setGraded] = useState(false)
  const card = (cards.find((item) => item.id === order[index]) || cards[0])!
  const cardContent = card.content as LibraryFlashcardContent
  function publish(patch: Partial<LibraryStudyProgress>) { if (!progress.current || !onProgress) return; progress.current = { ...progress.current, ...patch }; onProgress(progress.current) }
  function move(next: number) { const value = Math.max(0, Math.min(order.length - 1, next)); const now = new Date().toISOString(); setIndex(value); setFlipped(false); setGraded(false); publish({ index: { value, updatedAt: now }, side: { value: 'question', updatedAt: now } }) }
  function showSide(side: 'question' | 'answer') { setFlipped(side === 'answer'); publish({ side: { value: side, updatedAt: new Date().toISOString() } }) }
  function shuffle() {
    const next = shuffledIds(order)
    const nextIndex = Math.max(0, next.indexOf(card.id)); const now = new Date().toISOString()
    setOrder(next); setIndex(nextIndex); setFlipped(false); setGraded(false); publish({ order: { value: next, updatedAt: now }, index: { value: nextIndex, updatedAt: now }, side: { value: 'question', updatedAt: now } })
  }
  function grade(label: string) {
    if (graded || !flipped) return false
    const gradeValue = label.toLowerCase() as 'again' | 'hard' | 'good' | 'easy'; const now = new Date().toISOString()
    publish({ items: { ...progress.current?.items, [card.id]: { reviewed: gradeValue !== 'again', grade: gradeValue, updatedAt: now } } })
    if (label === 'Again') { setReviewed((current) => { const next = new Set(current); next.delete(card.id); return next }); showSide('question'); return true }
    setReviewed((current) => new Set(current).add(card.id))
    if (index < order.length - 1) move(index + 1)
    else setGraded(true)
    return true
  }
  useEffect(() => {
    onVoiceAction?.(async (action) => {
      if (action.type === 'flashcard.side') { showSide(action.side); return { ok: true, message: `${action.side === 'answer' ? 'Answer' : 'Question'} shown.` } }
      if (action.type === 'flashcard.navigate') { const next = index + (action.direction === 'next' ? 1 : -1); if (next < 0 || next >= order.length) return { ok: false, error: `There is no ${action.direction} card.` }; move(next); return { ok: true, message: `Moved to card ${next + 1}.` } }
      if (action.type === 'flashcard.shuffle') { shuffle(); return { ok: true, message: 'Deck shuffled.' } }
      if (action.type === 'flashcard.grade') return grade(action.grade[0].toUpperCase() + action.grade.slice(1)) ? { ok: true, message: `Card graded ${action.grade}.` } : { ok: false, error: flipped ? 'This card has already been graded.' : 'Reveal the answer before grading this card.' }
      return { ok: false, error: 'That action does not apply to Studio flashcards.' }
    })
    return () => onVoiceAction?.(undefined)
  })
  useEffect(() => { onVoiceState?.({ target: 'studio-flashcards', deckId: set.id!, cardId: card.id, index, count: order.length, side: flipped ? 'answer' : 'question', graded, question: { heading: 'Question', body: cardContent.front }, answer: flipped ? { heading: 'Answer', body: cardContent.back } : undefined }); return () => onVoiceState?.(undefined) }, [card.id, cardContent.back, cardContent.front, flipped, graded, index, onVoiceState, order.length, set.id])
  return <section className="library-redesign lr-study lr-generated-study learn-redesign flashcards-view" aria-label={`${set.title} flashcards`}>
    <header className="flashcard-study-header"><Button variant="ghost" className="library-back" onClick={onBack}><ArrowLeft />{readOnly ? 'Back to shared set' : 'All generations'}</Button><div><span className="page-kicker">Flashcards</span><h1>{set.title}</h1><p>{reviewed.size} of {cards.length} reviewed</p></div><aside><div><span>Reviewed</span><strong>{reviewed.size}/{cards.length}</strong></div><Progress value={(reviewed.size / cards.length) * 100} aria-label={`${reviewed.size} of ${cards.length} cards reviewed`} /></aside></header>
    <div className="flashcard-toolbar"><Button variant="ghost" size="sm" onClick={() => move(index - 1)} disabled={index === 0} aria-label="Previous card"><ArrowLeft /></Button><div><Button variant="ghost" size="sm" onClick={shuffle}><Shuffle />Shuffle</Button><span>Card {index + 1} of {order.length}</span></div><Button variant="ghost" size="sm" onClick={() => move(index + 1)} disabled={index === order.length - 1} aria-label="Next card"><ArrowRight /></Button></div>
    <Progress className="flashcard-mobile-progress" value={(reviewed.size / cards.length) * 100} aria-label={`${reviewed.size} of ${cards.length} cards reviewed`} />
    <Card className={`flashcard-stage ${flipped ? 'flipped' : ''}`} tabIndex={0} role="button" aria-label={`${flipped ? 'Answer' : 'Question'} side. ${flipped ? 'Tap to return to the question.' : 'Tap to reveal the answer.'}`} onClick={() => showSide(flipped ? 'question' : 'answer')} onKeyDown={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); showSide(flipped ? 'question' : 'answer') } else if (event.key === 'ArrowLeft') move(index - 1); else if (event.key === 'ArrowRight') move(index + 1) }}>
      <div className="flashcard-inner">
        <div className="flashcard-face flashcard-front text-only" aria-hidden={flipped} inert={flipped ? true : undefined}><div className="flashcard-copy"><span>Question</span><h2>{cardContent.front}</h2></div><small><ScanLine />Tap the card to flip and reveal the answer.</small></div>
        <div className="flashcard-face flashcard-back" aria-hidden={!flipped} inert={!flipped ? true : undefined}><div className="flashcard-answer-mark">Answer</div><h2>{cardContent.back}</h2></div>
      </div>
    </Card>
    <div className="flashcard-reveal">{flipped && <section className="study-grading" aria-label="Rate your recall"><div className="flashcard-grades">{['Again', 'Hard', 'Good', 'Easy'].map((gradeLabel) => <Button key={gradeLabel} variant="grade" disabled={graded} onClick={() => grade(gradeLabel)}>{gradeLabel}</Button>)}</div></section>}<Button variant="outline" className="mobile-flashcard-shuffle" onClick={shuffle}><Shuffle />Shuffle</Button></div>
  </section>
}

function PracticeStudy({ set, onBack, readOnly, initialProgress, onProgress, onReset, onGrade, onVoiceState, onVoiceAction }: { set: StudySet; onBack: () => void; readOnly: boolean; initialProgress?: LibraryStudyProgress; onProgress?: (progress: LibraryStudyProgress) => void; onReset?: () => Promise<LibraryStudyProgress>; onGrade?: (answers: Record<string, number>) => Promise<PracticeGrade>; onVoiceState?: (state: StudioVoiceState | undefined) => void; onVoiceAction?: (handler: StudioController['executeVoiceAction'] | undefined) => void }) {
  const questions = set.items.filter((item) => !contentIsFlashcard(item.content))
  const initial = initialProgress ?? (set.id && set.version ? newProgress(set) : undefined)
  const progress = useRef(initial)
  const [index, setIndex] = useState(() => initial?.index.value ?? 0)
  const [answers, setAnswers] = useState<Record<string, number>>(() => Object.fromEntries(Object.entries(initial?.items ?? {}).flatMap(([id, item]) => item.answer === undefined ? [] : [[id, item.answer]])))
  const [submitted, setSubmitted] = useState(() => initial?.submitted?.value ?? false)
  const [reviewing, setReviewing] = useState(() => initial?.reviewing?.value ?? false)
  const [gradeResults, setGradeResults] = useState<Record<string, { correctIndex: number; explanation: string }>>(() => Object.fromEntries(questions.flatMap((item) => {
    const content = item.content as LibraryPracticeContent
    return initial?.submitted?.value && content.correctIndex >= 0 ? [[item.id, { correctIndex: content.correctIndex, explanation: content.explanation }]] : []
  })))
  const [grading, setGrading] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const question = questions[index]!
  const storedQuestion = question.content as LibraryPracticeContent
  const revealedAnswer = gradeResults[question.id]
  const correctIndex = revealedAnswer?.correctIndex ?? storedQuestion.correctIndex
  const explanation = revealedAnswer?.explanation ?? storedQuestion.explanation
  const selected = answers[question.id]
  const answered = Object.keys(answers).length
  const score = questions.reduce((total, item) => {
    if (contentIsFlashcard(item.content)) return total
    const result = gradeResults[item.id]
    return result && answers[item.id] === result.correctIndex ? total + 1 : total
  }, 0)
  const percentage = Math.round((score / questions.length) * 100)
  const showingReview = submitted && reviewing
  function publish(patch: Partial<LibraryStudyProgress>) { if (!progress.current || !onProgress) return; progress.current = { ...progress.current, ...patch }; onProgress(progress.current) }
  function navigate(next: number) { const value = Math.max(0, Math.min(questions.length - 1, next)); setIndex(value); publish({ index: { value, updatedAt: new Date().toISOString() } }) }
  function select(option: number) { if (submitted) return false; const now = new Date().toISOString(); setAnswers((current) => ({ ...current, [question.id]: option })); publish({ items: { ...progress.current?.items, [question.id]: { answer: option, updatedAt: now } } }); return true }
  async function submit(confirmSubmission = false) { if (submitted || grading || answered !== questions.length || !onGrade) return false; if (confirmSubmission && !window.confirm('Submit this practice test for final grading?')) return false; setGrading(true); try { const grade = await onGrade(answers); const results = Object.fromEntries(grade.results.map((result) => [result.id, { correctIndex: result.correctIndex, explanation: result.explanation }])); setGradeResults(results); const now = new Date().toISOString(); setSubmitted(true); setReviewing(false); publish({ submitted: { value: true, updatedAt: now }, reviewing: { value: false, updatedAt: now }, score: { value: grade.score, updatedAt: now } }); return true } finally { setGrading(false) } }
  async function retry() { let next: LibraryStudyProgress | undefined; try { next = onReset ? await onReset() : set.id && set.version ? newProgress(set) : undefined } catch { return } progress.current = next; setAnswers({}); setGradeResults({}); setSubmitted(false); setReviewing(false); setIndex(0) }
  function review() { const now = new Date().toISOString(); setIndex(0); setReviewing(true); publish({ index: { value: 0, updatedAt: now }, reviewing: { value: true, updatedAt: now } }) }
  useEffect(() => {
    onVoiceAction?.(async (action) => {
      if (action.type === 'assessment.select') return action.optionIndex >= 0 && action.optionIndex < storedQuestion.options.length && select(action.optionIndex) ? { ok: true, message: `Option ${String.fromCharCode(65 + action.optionIndex)} selected for question ${index + 1}.` } : { ok: false, error: submitted ? 'This practice test has already been submitted.' : 'That option is not available.' }
      if (action.type === 'assessment.navigate') { const next = index + (action.direction === 'next' ? 1 : -1); if (next < 0 || next >= questions.length) return { ok: false, error: `There is no ${action.direction} question.` }; navigate(next); return { ok: true, message: `Moved to question ${next + 1}.` } }
       if (action.type === 'assessment.submit') return (await submit(true)) ? { ok: true, message: 'Practice test submitted.' } : { ok: false, error: submitted ? 'This practice test has already been submitted.' : answered !== questions.length ? 'Answer every question before submitting.' : 'The learner did not confirm submission.' }
      if (action.type === 'assessment.review') { if (!submitted) return { ok: false, error: 'Submit the practice test before reviewing answers.' }; review(); return { ok: true, message: 'Answer review opened.' } }
      return { ok: false, error: 'That action is not available for this Studio practice test.' }
    })
    return () => onVoiceAction?.(undefined)
  })
  useEffect(() => { onVoiceState?.({ target: 'studio-practice', questionId: question.id, index, count: questions.length, question: storedQuestion.question, options: storedQuestion.options, selectedIndex: selected ?? null, submitted, phase: submitted ? reviewing ? 'review' : 'result' : 'taking', score: submitted ? score : undefined, correctAnswer: showingReview ? storedQuestion.options[correctIndex] : undefined, explanation: showingReview ? explanation : undefined }); return () => onVoiceState?.(undefined) }, [correctIndex, explanation, index, onVoiceState, question.id, questions.length, reviewing, score, selected, showingReview, storedQuestion.options, storedQuestion.question, submitted])
  return <section className="library-redesign lr-study lr-generated-study content-view quiz-view assessment-view learn-redesign" aria-label={`${set.title} practice test`}>
    <header className="assessment-page-header"><Button variant="ghost" className="library-back" onClick={onBack}><ArrowLeft />{readOnly ? 'Back to shared set' : 'All generations'}</Button><div><span className="page-kicker">Practice test</span><h1>{set.title}</h1><p>{questions.length} questions. Answer every question, then submit the complete attempt for grading.</p></div></header>
    {submitted && !reviewing ? <section className="assessment-result" aria-live="polite"><div className="assessment-score"><div className="assessment-score-ring" style={{ background: `conic-gradient(var(--success) ${percentage}%, var(--learn-muted) 0)` }}><span><strong>{percentage}%</strong><small>{score} / {questions.length}</small></span></div></div><div className="assessment-result-copy"><h2>{percentage >= 70 ? 'Strong result.' : 'Keep building.'}</h2><p>You answered {score} of {questions.length} questions correctly.</p><div><Button variant="outline" onClick={review}>Review answers</Button><Button variant="outline" onClick={() => void retry()}><RotateCcw />Try again</Button><Button className="assessment-back-button" onClick={onBack}>Back to library</Button></div></div></section> : <div className="assessment-workspace">
      {navOpen && <button className="assessment-nav-backdrop" onClick={() => setNavOpen(false)} aria-label="Close question navigator" />}
      <Card className={`assessment-navigator ${navOpen ? 'mobile-open' : ''}`}><header><div><span>Progress</span><strong>{answered}/{questions.length}</strong><b className="mobile-current-question">Q{index + 1} <em>/ {questions.length}</em></b></div><Button variant="outline" className="mobile-question-nav-trigger" onClick={() => setNavOpen(true)}><LayoutGrid />{answered}/{questions.length}</Button><Progress value={(answered / questions.length) * 100} /></header><div className="mobile-navigator-title"><i /><strong>Question navigator</strong><span>{answered} of {questions.length} answered</span></div><div className="assessment-question-grid" aria-label="Assessment questions">{questions.map((entry, questionIndex) => <button key={entry.id} className={`${questionIndex === index ? 'active' : ''} ${answers[entry.id] !== undefined ? 'complete' : ''}`} onClick={() => { navigate(questionIndex); setNavOpen(false) }} aria-label={`Question ${questionIndex + 1}${answers[entry.id] !== undefined ? ', answered' : ', unanswered'}`} aria-current={questionIndex === index ? 'step' : undefined}>{questionIndex + 1}</button>)}</div><footer><span><i className="answered" />Answered</span><span><i className="current" />Current</span></footer></Card>
      <Card className="quiz-stage assessment-stage"><header><div><span className="question-number">{index + 1}</span><strong>Question {index + 1} of {questions.length}</strong></div></header><div className="assessment-question-copy"><h2>{storedQuestion.question}</h2></div><fieldset disabled={submitted}>{storedQuestion.options.map((option, optionIndex) => { const correct = showingReview && optionIndex === correctIndex; const isSelected = selected === optionIndex; return <label key={optionIndex} className={`${isSelected ? 'selected' : ''} ${showingReview ? `${correct ? 'correction-correct' : ''} ${isSelected && !correct ? 'correction-selected' : ''}` : ''}`}><input type="radio" name={`library-question-${question.id}`} checked={isSelected} onChange={() => select(optionIndex)} /><span>{String.fromCharCode(65 + optionIndex)}</span><b>{option}</b>{correct && <Check />}</label> })}</fieldset>{showingReview && <div className="assessment-correction"><span>Explanation</span><h3>{selected === correctIndex ? 'Your answer was correct.' : `Correct answer: ${storedQuestion.options[correctIndex]}`}</h3><p>{explanation}</p></div>}<footer><Button variant="ghost" onClick={() => navigate(index - 1)} disabled={index === 0}><ArrowLeft />Previous</Button><span>{answered} answered</span><div>{index < questions.length - 1 ? <Button onClick={() => navigate(index + 1)}>Next<ArrowRight /></Button> : !submitted ? <Button onClick={() => void submit()} disabled={answered !== questions.length || grading}>{grading ? 'Grading...' : 'Submit test'}</Button> : <Button onClick={() => void retry()}><RotateCcw />Try again</Button>}</div></footer></Card>
    </div>}
  </section>
}

function EmptyStudy({ onBack }: { onBack: () => void }) {
  return <section className="lr-state"><AlertTriangle /><h2>This set has no study items</h2><button onClick={onBack}>Back to library</button></section>
}

export function LibraryStudio({ onVoiceState, onController }: { onVoiceState?: (state: StudioVoiceState | undefined) => void; onController?: (controller: StudioController | undefined) => void } = {}) {
  const { user, loading: authLoading, balance, setBalance } = useAuth()
  const [sourceTab, setSourceTab] = useState<SourceTab>('prompt')
  const [prompt, setPrompt] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [linkInput, setLinkInput] = useState('')
  const [links, setLinks] = useState<StagedLink[]>([])
  const [outputType, setOutputType] = useState<LibraryOutputType>('flashcards')
  const [count, setCount] = useState(15)
  const [sets, setSets] = useState<LibrarySet[]>([])
  const [activeJobSetIds, setActiveJobSetIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LibrarySet | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [editorSaving, setEditorSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [studySet, setStudySet] = useState<(StudySet & { progress?: LibraryStudyProgress }) | null>(null)
  const [feedback, setFeedback] = useState('')
  const [progressError, setProgressError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const cancelRename = useRef(false)
  const latestProgress = useRef<LibraryStudyProgress | undefined>(undefined)
  const progressRunner = useRef<CoalescingRunner | undefined>(undefined)
  const refreshRunning = useRef<Promise<void> | undefined>(undefined)
  const refreshSequence = useRef(0)
  const studyVoiceAction = useRef<StudioController['executeVoiceAction'] | undefined>(undefined)
  const onControllerRef = useRef(onController)
  const userId = user?.id
  const signIn = () => window.location.assign(loginPath('/app?view=studio'))
  useEffect(() => { onControllerRef.current = onController }, [onController])

  useEffect(() => {
    const runner = createCoalescingRunner(async () => {
      const snapshot = latestProgress.current
      if (!snapshot || !userId) return
      storePendingProgress(userId, snapshot)
      const result = await upsertLibraryProgress(snapshot.setId, snapshot)
      const current = latestProgress.current
      if (current?.setId !== snapshot.setId) {
        clearPendingProgress(userId, snapshot.setId)
        return
      }
      const reconciled = mergeLibraryProgress(current, result.progress) ?? result.progress
      latestProgress.current = reconciled
      if (JSON.stringify(reconciled) === JSON.stringify(result.progress)) clearPendingProgress(userId, snapshot.setId)
      else storePendingProgress(userId, reconciled)
      setStudySet((value) => value && value.id === reconciled.setId && value.progress?.attemptId !== reconciled.attemptId ? { ...value, progress: reconciled } : value)
    }, 1_000)
    progressRunner.current = runner
    return () => { progressRunner.current = undefined; void runner.flush().catch(() => undefined).finally(() => runner.dispose()) }
  }, [userId])

  async function refresh(silent = false) {
    if (refreshRunning.current) return refreshRunning.current
    const sequence = ++refreshSequence.current
    const request = (async () => {
    if (!user) { setSets([]); setActiveJobSetIds(new Set()); setLoading(false); return }
    if (!silent) setLoading(true)
    try {
      const result = await listLibrary()
      if (sequence !== refreshSequence.current) return
      setSets(result.sets)
      setActiveJobSetIds(new Set(result.activeJobs.map((job) => job.setId)))
      setBalance(result.balance)
      setError('')
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { if (!silent && sequence === refreshSequence.current) setLoading(false) }
    })()
    refreshRunning.current = request
    try { await request } finally { if (refreshRunning.current === request) refreshRunning.current = undefined }
  }
  const refreshLibrary = useEffectEvent(refresh)

  useEffect(() => {
    if (authLoading) return
    const timer = window.setTimeout(() => void refreshLibrary(), 0)
    return () => window.clearTimeout(timer)
  }, [user?.id, authLoading])
  useEffect(() => {
    const generationInProgress = activeJobSetIds.size > 0 || sets.some((set) => set.status === 'generating')
    if (!generationInProgress) return
    const timer = window.setInterval(() => void refreshLibrary(true), 2_500)
    return () => window.clearInterval(timer)
  }, [activeJobSetIds.size, sets, user?.id])
  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => setFeedback(''), 3_000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const countOptions = outputType === 'flashcards' ? [10, 15, 20, 30] : [10, 20, 30, 40]
  const cost = libraryGenerationCost(count)
  const hasSource = sourceTab === 'prompt' ? Boolean(prompt.trim()) : sourceTab === 'upload' ? files.length > 0 : links.length > 0
  const activeSet = sets.find((set) => activeJobSetIds.has(set.id) || set.status === 'generating')

  useEffect(() => {
    if (!studySet) onVoiceState?.({ target: 'studio-catalog', sets: sets.filter((set) => set.status === 'ready').slice(0, 50).map((set) => ({ id: set.id, title: set.title, type: set.outputType })) })
  }, [onVoiceState, sets, studySet])

  const openVoiceSet = useEffectEvent(async (setId: string): Promise<VoiceActionResult> => {
    const target = sets.find((set) => set.id === setId && set.status === 'ready')
    if (!target) return { ok: false, error: 'That ready Studio set is not in the visible library.' }
    if ((studySet || editorDirty()) && !window.confirm('Leave the current Studio activity and open the requested set?')) return { ok: false, error: 'The learner chose to keep the current Studio activity open.' }
    if (!await openStudy(target)) return { ok: false, error: 'The Studio set could not be opened.' }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    return { ok: true, message: `${target.title} opened.` }
  })

  useEffect(() => {
    const controller: StudioController = {
      openSet: openVoiceSet,
      executeVoiceAction: (action) => studyVoiceAction.current?.(action) ?? { ok: false, error: 'Studio study controls are not ready.' },
    }
    onControllerRef.current?.(controller)
    return () => onControllerRef.current?.(undefined)
  }, [])

  function changeOutput(next: LibraryOutputType) {
    setOutputType(next)
    setCount(next === 'flashcards' ? 15 : 20)
  }

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList)
    if (!incoming.length) return
    const categories = incoming.map((file) => (LIBRARY_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type) ? 'document' : (LIBRARY_AUDIO_MIME_TYPES as readonly string[]).includes(file.type) ? 'audio' : null)
    const existingCategory = files[0] ? ((LIBRARY_DOCUMENT_MIME_TYPES as readonly string[]).includes(files[0].type) ? 'document' : 'audio') : categories[0]
    if (categories.some((category) => !category || category !== existingCategory)) return setError('Choose documents or audio only. Document and audio files cannot be mixed.')
    if (incoming.some((file) => file.size < 1 || file.size > LIBRARY_MAX_FILE_BYTES)) return setError('Each file must be no larger than 25 MB.')
    if (files.length + incoming.length > LIBRARY_MAX_SOURCES) return setError('You can add up to 10 files.')
    setFiles((current) => [...current, ...incoming]); setError('')
  }

  function stageFiles(event: ChangeEvent<HTMLInputElement>) {
    addFiles(event.target.files || [])
    event.target.value = ''
  }

  function dropFiles(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    addFiles(event.dataTransfer.files)
  }

  function addLink() {
    const url = linkInput.trim()
    if (!validHttpsUrl(url)) return setError('Enter a valid HTTPS YouTube or article URL.')
    const category = isYoutube(url) ? 'youtube' : 'link'
    if (links[0] && links[0].category !== category) return setError('Use either YouTube links or article links in one generation, not both.')
    if (links.length >= LIBRARY_MAX_SOURCES) return setError('You can add up to 10 links.')
    if (links.some((link) => link.url === url)) return setError('That link is already staged.')
    setLinks((current) => [...current, { id: crypto.randomUUID(), url, category }]); setLinkInput(''); setError('')
  }

  async function generate() {
    if (!user) { window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return }
    if (balance && balanceTotal(balance) < cost) return setError(`You need ${cost} credits to generate this set.`)
    if (sourceTab === 'prompt' && !prompt.trim()) return setError('Describe what you want to study.')
    if (sourceTab === 'upload' && !files.length) return setError('Add at least one document or audio file.')
    if (sourceTab === 'link' && !links.length) return setError('Add at least one YouTube or article link.')
    setGenerating(true); setError('')
    const uploadedPaths: string[] = []
    let pendingSetId = ''
    let accepted = false
    try {
      let sourceCategory: LibrarySourceCategory = 'prompt'
      let sources: Array<{ text: string } | { url: string; category: 'link' | 'youtube' } | LibraryFileSource> = [{ text: prompt.trim() }]
      if (sourceTab === 'upload') {
        sourceCategory = (LIBRARY_DOCUMENT_MIME_TYPES as readonly string[]).includes(files[0].type) ? 'document' : 'audio'
        sources = []
        for (const file of files) {
          const source = await uploadLibraryInput(file, sourceCategory)
          uploadedPaths.push(source.storagePath)
          sources.push(source)
        }
      } else if (sourceTab === 'link') {
        sourceCategory = links[0].category
        sources = links.map(({ url, category }) => ({ url, category }))
      }
      const title = suggestedTitle(sourceTab, prompt, files, links)
      const setId = crypto.randomUUID()
      pendingSetId = setId
      const result = await createLibraryGeneration({ setId, expectedVersion: null, title, outputType, requestedCount: count, sourceCategory, sources })
      accepted = true
      refreshSequence.current += 1
      setBalance({ freeBalance: result.freeBalance, subscriptionBalance: result.subscriptionBalance, purchasedBalance: result.purchasedBalance })
      const now = new Date().toISOString()
      setSets((current) => [{ id: setId, title, outputType, sourceCategory, requestedCount: count, itemCount: 0, generationCost: result.cost, version: result.version, status: 'generating', createdAt: now, updatedAt: now }, ...current.filter((set) => set.id !== setId)])
      setActiveJobSetIds((current) => new Set(current).add(setId))
      setPrompt(''); setFiles([]); setLinks([]); setLinkInput('')
    } catch (requestError) {
      if (!accepted && uploadedPaths.length) {
        let jobOwnsUploads = false
        if (pendingSetId) {
          try { jobOwnsUploads = (await listLibrary()).sets.some((set) => set.id === pendingSetId) } catch { jobOwnsUploads = true }
        }
        if (!jobOwnsUploads) await removeLibraryInputs(uploadedPaths)
      }
      if (requestError instanceof AIActionError && requestError.balance) setBalance(requestError.balance)
      await refresh(true)
      setError(errorMessage(requestError))
    } finally { setGenerating(false) }
  }

  async function openStudy(set: LibrarySet) {
    if (set.status !== 'ready') return false
    try {
      const result = await getLibrarySet(set.id)
      const pending = user ? loadPendingProgress(user.id)[set.id] : undefined
      const progress = mergeLibraryProgress(pending, result.progress) ?? newProgress({ id: result.set.id, version: result.set.version, title: result.set.title, outputType: result.set.outputType, items: result.items })
      latestProgress.current = progress
      setStudySet({ id: result.set.id, version: result.set.version, title: result.set.title, outputType: result.set.outputType, items: result.items, progress })
      if (pending) void progressRunner.current?.request().catch(() => setProgressError('Progress could not be synced.'))
      return true
    } catch (requestError) { setError(errorMessage(requestError)); return false }
  }

  async function beginEdit(set: LibrarySet) {
    setOpenMenu(null)
    try {
      const result = await getLibrarySet(set.id, 'edit')
      const items = structuredClone(result.items)
      setEditor({ set: result.set, title: result.set.title, originalTitle: result.set.title, items, originalItems: structuredClone(items), deleted: [] })
    } catch (requestError) { setError(errorMessage(requestError)) }
  }

  function editorDirty(value = editor) {
    return Boolean(value && (value.title.trim() !== value.originalTitle || value.deleted.length || JSON.stringify(value.items) !== JSON.stringify(value.originalItems)))
  }

  function requestEditorClose() {
    if (editorDirty()) setConfirmDiscard(true)
    else setEditor(null)
  }

  async function saveEditor() {
    if (!editor || !editor.title.trim()) return setError('Set title cannot be empty.')
    setEditorSaving(true); setError('')
    try {
      const original = new Map(editor.originalItems.map((item) => [item.id, item]))
      const edits: Array<{ id: string; delete: true } | { id: string; content: LibraryItemContent }> = editor.deleted.map((id) => ({ id, delete: true as const }))
      for (const item of editor.items) if (JSON.stringify(item.content) !== JSON.stringify(original.get(item.id)?.content)) edits.push({ id: item.id, content: item.content })
      if (edits.length || editor.title.trim() !== editor.originalTitle) await bulkEditLibraryItems(editor.set.id, editor.set.version, editor.title.trim(), edits)
      setEditor(null); await refresh(true)
    } catch (requestError) { setError(errorMessage(requestError)) }
    finally { setEditorSaving(false) }
  }

  async function commitRename() {
    if (cancelRename.current) { cancelRename.current = false; return }
    if (!renaming) return
    const value = renaming.value.trim()
    const existing = sets.find((set) => set.id === renaming.id)
    setRenaming(null)
    if (!value || value === existing?.title) return
    try { const result = await renameLibrarySet(renaming.id, value); setSets((current) => current.map((set) => set.id === renaming.id ? result.set : set)) }
    catch (requestError) { setError(errorMessage(requestError)) }
  }

  async function share(set: LibrarySet) {
    setOpenMenu(null)
    try { const result = await createLibraryShare(set.id); await navigator.clipboard.writeText(result.shareUrl); setFeedback('Share link copied') }
    catch (requestError) { setError(errorMessage(requestError)) }
  }

  async function confirmDeleteSet() {
    if (!deleteTarget) return
    try { await deleteLibrarySet(deleteTarget.id); setSets((current) => current.filter((set) => set.id !== deleteTarget.id)); setDeleteTarget(null) }
    catch (requestError) { setError(errorMessage(requestError)) }
  }

  if (studySet) return <><LibraryStudyExperience key={studySet.progress?.attemptId} set={studySet} initialProgress={studySet.progress} onProgress={(progress) => { latestProgress.current = progress; if (user) storePendingProgress(user.id, progress); void progressRunner.current?.request().then(() => setProgressError('')).catch(() => setProgressError('Progress could not be synced.')) }} onReset={async () => { try { await progressRunner.current?.flush(); const result = await resetLibraryProgress(studySet.id!); latestProgress.current = result.progress; if (user) clearPendingProgress(user.id, studySet.id!); setProgressError(''); return result.progress } catch (requestError) { setProgressError(errorMessage(requestError)); throw requestError } }} onGrade={(answers) => gradeLibrarySet(studySet.id!, answers)} onVoiceState={onVoiceState} onVoiceAction={(handler) => { studyVoiceAction.current = handler }} onBack={() => { const runner = progressRunner.current; void runner?.flush().catch(() => undefined); setStudySet(null); latestProgress.current = undefined; setProgressError('') }} />{progressError && <div className="lr-toast" role="alert"><AlertTriangle />{progressError}</div>}</>

  return <main className={`library-redesign ${activeSet ? 'has-active-generation' : ''}`}>
    {activeSet && <section className="lr-mobile-generating" aria-live="polite"><span><Sparkles /></span><h1>Creating {activeSet.requestedCount} {activeSet.outputType === 'flashcards' ? 'flashcards' : 'practice questions'}</h1><p>Reading your material and drafting your study set. This may take a few minutes.</p><i><b /></i><small><LoaderCircle className="spin" />Extracting key concepts...</small></section>}
    <div className="lr-page">
      <header className="lr-hero"><span><Sparkles /> Generative studio</span><h1><b className="lr-desktop-title">Library</b><b className="lr-mobile-title">Create a set</b></h1><p>Turn anything into source-grounded study material. Write a prompt, add documents or audio, or paste links to generate flashcards and practice tests.</p></header>
      <section className={`lr-composer ${!user ? 'guest-locked' : ''}`} aria-label="Generate study material">
        <div className="lr-source-tabs" role="tablist" aria-label="Source type" inert={!user ? true : undefined}>
          <button className={sourceTab === 'prompt' ? 'active' : ''} onClick={() => setSourceTab('prompt')} role="tab" aria-selected={sourceTab === 'prompt'}><Pencil />Prompt</button>
          <button className={sourceTab === 'upload' ? 'active' : ''} onClick={() => setSourceTab('upload')} role="tab" aria-selected={sourceTab === 'upload'}><Upload />Upload</button>
          <button className={sourceTab === 'link' ? 'active' : ''} onClick={() => setSourceTab('link')} role="tab" aria-selected={sourceTab === 'link'}><LinkIcon />Link</button>
        </div>
        <div className="lr-input-area" inert={!user ? true : undefined}>
          {sourceTab === 'prompt' && <><label className="sr-only" htmlFor="library-prompt">Study prompt</label><textarea id="library-prompt" value={prompt} maxLength={20_000} onChange={(event) => setPrompt(event.target.value)} placeholder="Describe what you want to study, for example: Second-year cardiology, the cardiac cycle and valve timing." /><div className="lr-chips"><span>Try:</span>{promptIdeas.map((idea, index) => <button className={index > 1 ? 'lr-extra-prompt-idea' : ''} key={idea} onClick={() => setPrompt(idea)}>{idea}</button>)}</div></>}
          {sourceTab === 'upload' && <>
            <input ref={fileInput} className="sr-only" type="file" multiple accept=".pdf,.docx,.md,audio/mpeg,audio/mp4,audio/m4a,audio/wav" onChange={stageFiles} />
            <button className="lr-dropzone" onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={dropFiles}><Upload /><strong>Drag and drop or <span>browse files</span></strong><small>PDF, DOCX, Markdown, audio - up to 25 MB each</small></button>
            <div className="lr-chips lr-formats" aria-label="Supported file formats"><span><FileText />PDF</span><span><File />DOCX</span><span><FileCode2 />Markdown</span><span><Mic />Audio</span></div>
            <div className="lr-staged">{files.map((file, index) => <div key={`${file.name}-${index}`}>{(LIBRARY_AUDIO_MIME_TYPES as readonly string[]).includes(file.type) ? <Mic /> : <FileText />}<span><strong>{file.name}</strong><small>{(file.size / 1_048_576).toFixed(1)} MB</small></span><button onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}><X /></button></div>)}</div>
          </>}
          {sourceTab === 'link' && <>
            <div className="lr-link-input"><LinkIcon /><label className="sr-only" htmlFor="library-link">YouTube or article URL</label><input id="library-link" value={linkInput} onChange={(event) => setLinkInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addLink() }} placeholder="Paste a YouTube, article, or web page URL" /><button onClick={addLink}><Plus /> Add</button></div>
            <div className="lr-chips lr-formats" aria-label="Supported link types"><span><CirclePlay />YouTube</span><span><LinkIcon />Articles</span><span><Globe2 />Web pages</span></div>
            <div className="lr-staged">{links.map((link) => <div key={link.id}><LinkIcon /><span><strong>{link.url}</strong><small>{link.category === 'youtube' ? 'YouTube' : 'Article'}</small></span><button onClick={() => setLinks((current) => current.filter((item) => item.id !== link.id))} aria-label={`Remove ${link.url}`}><X /></button></div>)}</div>
          </>}
        </div>
        <div className="lr-controls" inert={!user ? true : undefined}>
          <div className="lr-control-group"><label>Create</label><div className="lr-segment"><button className={outputType === 'flashcards' ? 'active' : ''} onClick={() => changeOutput('flashcards')}><Layers3 />Flashcards</button><button className={outputType === 'practice' ? 'active' : ''} onClick={() => changeOutput('practice')}><ClipboardCheck />Practice test</button></div></div>
          <div className="lr-control-group"><label>{outputType === 'flashcards' ? 'Cards' : 'Questions'}</label><div className="lr-counts">{countOptions.map((option) => <button key={option} className={count === option ? 'active' : ''} onClick={() => setCount(option)}>{option}</button>)}</div></div>
          <button className="lr-generate" disabled={generating || authLoading || !hasSource} onClick={() => void generate()}>{generating ? <><LoaderCircle className="spin" />Preparing sources...</> : <><Sparkles />{user ? `Generate ${outputType === 'flashcards' ? 'flashcards' : 'practice test'}` : 'Sign in to generate'}<b>{cost}</b></>}</button>
        </div>
        {!authLoading && !user && <button type="button" className="lr-auth-gate" onClick={signIn}><Layers3 /><strong>Sign in to create study material</strong><span>Your Library and generations stay connected to your account.</span></button>}
      </section>

      {error && <div className="lr-alert" role="alert"><AlertTriangle />{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X /></button></div>}
      <section className="lr-recent" aria-labelledby="recent-generations">
        <header><h2 id="recent-generations">Recent generations</h2><i /><span>{sets.length} {sets.length === 1 ? 'set' : 'sets'}</span></header>
        {loading ? <div className="lr-state"><LoaderCircle className="spin" /><h2>Loading your library</h2></div> : !user ? <div className="lr-state"><Layers3 /><h2>Sign in to see your library</h2><p>Your generated sets will stay organized here.</p><button onClick={signIn}>Sign in</button></div> : !sets.length ? <div className="lr-state"><Sparkles /><h2>Your library is ready</h2><p>Create your first set from a prompt, upload, or link.</p></div> : <div className="lr-grid">
          {sets.map((set) => {
            const active = activeJobSetIds.has(set.id) || set.status === 'generating'
            return <article className={`lr-set-card status-${set.status}`} key={set.id}>
              <header><span className={`source-${set.sourceCategory}`}>{set.sourceCategory === 'audio' ? <Mic /> : set.sourceCategory === 'prompt' ? <Pencil /> : set.sourceCategory === 'document' ? <FileText /> : <LinkIcon />}{set.sourceCategory}</span><span className={`lr-output output-${set.outputType}`}>{set.outputType === 'flashcards' ? <Layers3 /> : <ClipboardCheck />}{set.outputType === 'flashcards' ? 'Flashcards' : 'Practice'}</span><button className="lr-menu-trigger" onClick={() => setOpenMenu(openMenu === set.id ? null : set.id)} aria-label={`Options for ${set.title}`} aria-expanded={openMenu === set.id}><MoreVertical /></button></header>
              {renaming?.id === set.id ? <input className="lr-rename" autoFocus value={renaming.value} onChange={(event) => setRenaming({ ...renaming, value: event.target.value })} onBlur={() => void commitRename()} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === 'Enter') { event.preventDefault(); void commitRename() } if (event.key === 'Escape') { event.preventDefault(); cancelRename.current = true; setRenaming(null) } }} aria-label="Set name" /> : <h3>{set.title}</h3>}
              {active && <div className="lr-job"><LoaderCircle className="spin" /><span>Generating {set.requestedCount} {set.outputType === 'flashcards' ? 'cards' : 'questions'}...</span></div>}
              {set.status === 'failed' && <div className="lr-job failed"><AlertTriangle /><span>Generation failed</span></div>}
              <footer><span>{set.itemCount || set.requestedCount} items · {relativeTime(set.createdAt)}</span><button disabled={set.status !== 'ready'} onClick={() => void openStudy(set)}>{set.outputType === 'flashcards' ? 'Study' : 'Take test'} <ArrowRight /></button></footer>
              {openMenu === set.id && <><button className="lr-menu-scrim" onClick={() => setOpenMenu(null)} aria-label="Close menu" /><div className="lr-card-menu" role="menu" aria-label="Set options">
                <button role="menuitem" onClick={() => void beginEdit(set)}><Pencil />Edit {set.outputType === 'flashcards' ? 'cards' : 'questions'}</button>
                 <button role="menuitem" onClick={() => { cancelRename.current = false; setRenaming({ id: set.id, value: set.title }); setOpenMenu(null) }}><Type />Rename set</button>
                <button role="menuitem" onClick={() => void share(set)}><Share2 />Share</button>
                <hr />
                <button className="danger" role="menuitem" onClick={() => { setDeleteTarget(set); setOpenMenu(null) }}><Trash2 />Delete</button>
              </div></>}
            </article>
          })}
        </div>}
      </section>
    </div>
    {feedback && <div className="lr-toast" role="status"><Check />{feedback}</div>}
    {editor && <EditorModal state={editor} setState={setEditor} saving={editorSaving} onClose={requestEditorClose} onSave={() => void saveEditor()} />}
    {confirmDiscard && <ConfirmDialog title="Discard changes?" description="You have unsaved edits to this set. Leaving now will discard them." confirm="Discard" danger onCancel={() => setConfirmDiscard(false)} onConfirm={() => { setConfirmDiscard(false); setEditor(null) }} />}
    {deleteTarget && <ConfirmDialog title="Delete this set?" description={`"${deleteTarget.title}" and all its items will be permanently removed. This cannot be undone.`} confirm="Delete set" danger onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDeleteSet()} />}
  </main>
}

function EditorModal({ state, setState, saving, onClose, onSave }: { state: EditorState; setState: (state: EditorState) => void; saving: boolean; onClose: () => void; onSave: () => void }) {
  function updateContent(index: number, content: LibraryItemContent) { setState({ ...state, items: state.items.map((item, itemIndex) => itemIndex === index ? { ...item, content } : item) }) }
  function deleteItem(index: number) {
    if (state.items.length === 1) return
    const item = state.items[index]
    setState({ ...state, items: state.items.filter((_, itemIndex) => itemIndex !== index), deleted: [...state.deleted, item.id] })
  }
  useEffect(() => {
    function escape(event: globalThis.KeyboardEvent) { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape)
  }, [onClose])
  return <div className="lr-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="lr-editor" role="dialog" aria-modal="true" aria-labelledby="library-editor-heading">
      <header><span><Pencil /></span><div><small id="library-editor-heading">{state.set.outputType === 'flashcards' ? 'Edit cards' : 'Edit questions'}</small><label className="sr-only" htmlFor="library-editor-title">Set title</label><input id="library-editor-title" value={state.title} maxLength={160} onChange={(event) => setState({ ...state, title: event.target.value })} /></div><button onClick={onClose} aria-label="Close editor"><X /></button></header>
      <div className="lr-editor-list">{state.items.map((item, index) => {
        const content = item.content
        return <article key={item.id}>
          <header><span>{index + 1}</span><button disabled={state.items.length === 1} onClick={() => deleteItem(index)} aria-label={`Delete item ${index + 1}`} title={state.items.length === 1 ? 'A set must keep at least one item' : 'Delete item'}><Trash2 /></button></header>
          {contentIsFlashcard(content) ? <div className="lr-card-fields"><label>Front<textarea value={content.front} onChange={(event) => updateContent(index, { ...content, front: event.target.value })} /></label><label>Back<textarea value={content.back} onChange={(event) => updateContent(index, { ...content, back: event.target.value })} /></label></div> : <div className="lr-question-fields"><label>Question<AutoGrowTextarea value={content.question} onChange={(value) => updateContent(index, { ...content, question: value })} /></label><fieldset><legend>Answers - select the correct answer</legend>{content.options.map((option, optionIndex) => <label className={content.correctIndex === optionIndex ? 'correct' : ''} key={optionIndex}><input type="radio" name={`correct-${item.id}`} checked={content.correctIndex === optionIndex} onChange={() => updateContent(index, { ...content, correctIndex: optionIndex })} /><span>{String.fromCharCode(65 + optionIndex)}</span><input value={option} onChange={(event) => { const options = [...content.options] as [string, string, string, string]; options[optionIndex] = event.target.value; updateContent(index, { ...content, options }) }} /></label>)}</fieldset></div>}
        </article>
      })}</div>
      <footer><span>{state.items.length} {state.set.outputType === 'flashcards' ? 'cards' : 'questions'}</span><div><button onClick={onClose}>Cancel</button><button className="primary" disabled={saving} onClick={onSave}>{saving ? <LoaderCircle className="spin" /> : <Save />}Save changes</button></div></footer>
    </section>
  </div>
}

function ConfirmDialog({ title, description, confirm, danger, onCancel, onConfirm }: { title: string; description: string; confirm: string; danger?: boolean; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    function escape(event: globalThis.KeyboardEvent) { if (event.key === 'Escape') onCancel() }
    document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape)
  }, [onCancel])
  return <div className="lr-modal-backdrop lr-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}><section className="lr-confirm" role="alertdialog" aria-modal="true" aria-labelledby="lr-confirm-title" aria-describedby="lr-confirm-description">{confirm === 'Delete set' ? <Trash2 /> : <AlertTriangle />}<h2 id="lr-confirm-title">{title}</h2><p id="lr-confirm-description">{description}</p><footer><button onClick={onCancel}>Cancel</button><button autoFocus className={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirm}</button></footer></section></div>
}

export default LibraryStudio

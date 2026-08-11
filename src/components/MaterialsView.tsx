import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, ClipboardList, Eye, GalleryVerticalEnd, Lightbulb, RotateCcw, Search, Shuffle } from 'lucide-react'
import type { FlashcardDeckProgress, FlashcardGrade } from '../types'
import type { ActiveNoteContext, LibraryContentMode, MaterialFlashcard, MaterialFlashcardVoiceState, MaterialLearningController, MaterialLearningState, MaterialMnemonic, MaterialQuestion, MaterialSection, MaterialSectionSummary, MaterialSubject } from '../types/materials'
import { getMaterialSection, listMaterialFlashcards, listMaterialMnemonics, listMaterialQuestions, listMaterialSections, listMaterialSubjects, materialFlashcardFace } from '../lib/materials'
import { shuffledIds } from '../lib/flashcards'
import { generateMaterialCorrections, generateMaterialFlashcardHint, generateMaterialQuestionHint } from '../lib/quiz'
import { AIActionError, type CreditBalance } from '../lib/ai'
import type { VoiceAction, VoiceActionResult } from '../lib/voiceActions'
import { MaterialMarkdown } from './MaterialMarkdown'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'

type Props = {
  mode: LibraryContentMode
  progressByDeck: Record<string, FlashcardDeckProgress>
  onGrade: (subject: MaterialSubject, cardId: string, grade: FlashcardGrade) => void
  onSubjectChange: (subject?: MaterialSubject) => void
  onNoteContext: (context?: ActiveNoteContext) => void
  onNoteRequest: (prompt: string) => void
  signedIn: boolean
  creditBalance?: number
  onBalance: (balance: CreditBalance) => void
  onInsufficientCredits: (action: string, required: number) => void
  onSignIn: () => void
  onLearningState: (state?: MaterialLearningState) => void
  onLearningController: (controller?: MaterialLearningController) => void
}

type LearningProps = Pick<Props, 'signedIn' | 'creditBalance' | 'onBalance' | 'onInsufficientCredits' | 'onSignIn' | 'onLearningState' | 'onLearningController'>

function Loading() { return <div className="materials-state" role="status">Loading materials...</div> }
function Failure({ message, retry }: { message: string; retry: () => void }) { return <div className="materials-state error" role="alert"><p>{message}</p><Button variant="outline" onClick={retry}>Try again</Button></div> }

export default function MaterialsView(props: Props) {
  const { mode, progressByDeck, onGrade, onSubjectChange, onNoteContext } = props
  const [subjects, setSubjects] = useState<MaterialSubject[]>()
  const [subject, setSubject] = useState<MaterialSubject>()
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string>()
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let current = true
    listMaterialSubjects().then((rows) => { if (!current) return; setSubjects(rows); const requested = new URLSearchParams(window.location.search).get('subject'); if (requested) setSubject(rows.find((entry) => entry.slug === requested)) }).catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : 'Materials could not be loaded.') })
    return () => { current = false }
  }, [reload])
  function selectSubject(next?: MaterialSubject) {
    setSubject(next); onSubjectChange(next); if (!next) onNoteContext(undefined)
    const url = new URL(window.location.href)
    if (next) url.searchParams.set('subject', next.slug); else url.searchParams.delete('subject')
    window.history.replaceState({}, '', url)
  }
  if (error) return <Failure message={error} retry={() => { setError(undefined); setReload((value) => value + 1) }} />
  if (!subjects) return <Loading />
  if (subject) return <SubjectMaterials {...props} subject={subject} progress={progressByDeck[`materials:${subject.releaseId}`]} onCardGrade={(cardId, grade) => onGrade(subject, cardId, grade)} onBack={() => selectSubject(undefined)} />
  const normalized = query.trim().toLowerCase()
  const filtered = subjects.filter((entry) => entry.title.toLowerCase().includes(normalized))
  const copy = mode === 'notes' ? { heading: 'Notes by subject', detail: 'Read and review your course notes.', Icon: BookOpen } : mode === 'practice' ? { heading: 'Practice by subject', detail: 'Test your understanding by subject.', Icon: ClipboardList } : { heading: 'Flashcards by subject', detail: 'Build recall one subject at a time.', Icon: GalleryVerticalEnd }
  return <section className="materials-catalog" aria-labelledby="materials-heading"><div className="materials-catalog-heading"><div><h2 id="materials-heading">{copy.heading}</h2><p>{copy.detail}</p></div><label className="library-search"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search subjects" /></label></div>{filtered.length ? <div className="materials-grid">{filtered.map((entry) => <Card key={entry.id} className="material-subject-card"><header><span className="resource-icon material"><copy.Icon /></span></header><div><h3>{entry.title}</h3></div><footer><Button size="sm" onClick={() => selectSubject(entry)}>Open<ArrowRight /></Button></footer></Card>)}</div> : <div className="empty-state">No subjects match “{query}”.</div>}</section>
}

function SubjectMaterials({ mode, subject, progress, onCardGrade, onNoteContext, onNoteRequest, onBack, ...learning }: LearningProps & { mode: LibraryContentMode; subject: MaterialSubject; progress?: FlashcardDeckProgress; onCardGrade: (cardId: string, grade: FlashcardGrade) => void; onNoteContext: Props['onNoteContext']; onNoteRequest: Props['onNoteRequest']; onBack: () => void }) {
  useEffect(() => { if (mode !== 'notes') onNoteContext(undefined) }, [mode, onNoteContext])
  return <section className="subject-materials"><header className="subject-materials-header"><Button variant="ghost" className="library-back" onClick={onBack}><ArrowLeft />All {mode === 'practice' ? 'practice tests' : mode}</Button><div><h2>{subject.title}</h2></div></header>{mode === 'notes' && <MaterialNotes subject={subject} onNoteContext={onNoteContext} onNoteRequest={onNoteRequest} />}{mode === 'flashcards' && <MaterialCards subject={subject} progress={progress} onGrade={onCardGrade} {...learning} />}{mode === 'practice' && <MaterialPractice subject={subject} {...learning} />}</section>
}

function MaterialNotes({ subject, onNoteContext, onNoteRequest }: { subject: MaterialSubject; onNoteContext: Props['onNoteContext']; onNoteRequest: Props['onNoteRequest'] }) {
  const [sections, setSections] = useState<MaterialSectionSummary[]>()
  const [section, setSection] = useState<MaterialSection>()
  const [mnemonics, setMnemonics] = useState<MaterialMnemonic[]>([])
  const [selectedId, setSelectedId] = useState<string>()
  const [error, setError] = useState<string>()
  const [reload, setReload] = useState(0)
  useEffect(() => { let current = true; Promise.all([listMaterialSections(subject.releaseId), listMaterialMnemonics(subject.releaseId)]).then(([nextSections, nextMnemonics]) => { if (current) { setSections(nextSections); setMnemonics(nextMnemonics); setSelectedId(nextSections[0]?.id) } }).catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : 'Notes could not be loaded.') }); return () => { current = false } }, [reload, subject.releaseId])
  useEffect(() => { if (!selectedId) return; let current = true; getMaterialSection(subject.releaseId, selectedId).then((row) => { if (current) setSection(row) }).catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : 'This section could not be loaded.') }); return () => { current = false } }, [reload, selectedId, subject.releaseId])
  useEffect(() => { if (section) onNoteContext({ subject: subject.title, subjectSlug: subject.slug, releaseId: subject.releaseId, sectionId: section.id, section: section.title, pageStart: section.pageStart, pageEnd: section.pageEnd, selectedText: '' }) }, [onNoteContext, section, subject.releaseId, subject.slug, subject.title])
  if (error) return <Failure message={error} retry={() => { setError(undefined); setReload((value) => value + 1) }} />
  if (!sections) return <Loading />
  if (!sections.length) return <div className="materials-state">No notes are available for this subject yet.</div>
  const mnemonicMap = new Map(mnemonics.map((entry) => [entry.id, entry]))
  const context = section ? { subject: subject.title, subjectSlug: subject.slug, releaseId: subject.releaseId, sectionId: section.id, section: section.title, pageStart: section.pageStart, pageEnd: section.pageEnd } : undefined
  function selectSection(id: string) { setSection(undefined); setSelectedId(id) }
  return <div className="material-notes-layout"><aside className="material-section-list"><label>Section<select value={selectedId} onChange={(event) => selectSection(event.target.value)}>{sections.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label><nav aria-label="Note sections">{sections.map((entry) => <button key={entry.id} className={selectedId === entry.id ? 'active' : ''} onClick={() => selectSection(entry.id)}><span>{entry.ordinal + 1}</span>{entry.title}</button>)}</nav></aside><article className="material-note">{section && context ? <><header><h1>{section.title}</h1></header><MaterialMarkdown markdown={section.content} mnemonics={mnemonicMap} noteContext={context} onSelection={(selectedText) => onNoteContext({ ...context, selectedText })} onRequest={onNoteRequest} /></> : <Loading />}</article></div>
}

function MaterialCards({ subject, progress, onGrade, signedIn, onBalance, onInsufficientCredits, onSignIn, onLearningState, onLearningController }: LearningProps & { subject: MaterialSubject; progress?: FlashcardDeckProgress; onGrade: (cardId: string, grade: FlashcardGrade) => void }) {
  const [cards, setCards] = useState<MaterialFlashcard[]>(), [order, setOrder] = useState<string[]>([]), [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false), [graded, setGraded] = useState(false), [hints, setHints] = useState<Record<string, string>>({})
  const [loadingHintId, setLoadingHintId] = useState<string>(), [aiError, setAiError] = useState<string>(), [error, setError] = useState<string>(), [reload, setReload] = useState(0)
  const actionHandler = useRef<(action: Extract<VoiceAction, { type: `flashcard.${string}` | `materialFlashcard.${string}` }>) => Promise<VoiceActionResult>>(async () => ({ ok: false, error: 'The flashcard is still loading.' }))
  useEffect(() => { let current = true; listMaterialFlashcards(subject.releaseId).then((rows) => { if (current) { setCards(rows); setOrder(rows.map((entry) => entry.id)) } }).catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : 'Flashcards could not be loaded.') }); return () => { current = false } }, [reload, subject.releaseId])
  useEffect(() => { const controller: MaterialLearningController = { target: 'material-flashcards', executeVoiceAction: (action) => actionHandler.current(action as Extract<VoiceAction, { type: `flashcard.${string}` | `materialFlashcard.${string}` }>) }; onLearningController(controller); return () => onLearningController(undefined) }, [onLearningController])
  const byId = useMemo(() => new Map(cards?.map((entry) => [entry.id, entry])), [cards]), card = byId.get(order[index])
  function navigate(next: number) { setIndex(Math.max(0, Math.min(order.length - 1, next))); setRevealed(false); setGraded(false) }
  function shuffle() { if (!card) return; const next = shuffledIds(order); setOrder(next); setIndex(Math.max(0, next.indexOf(card.id))); setRevealed(false); setGraded(false) }
  function gradeCurrent(grade: FlashcardGrade) { if (!card || graded || !revealed) return false; onGrade(card.id, grade); setGraded(true); return true }
  async function requestHint() {
    if (!card || hints[card.id] || loadingHintId) return Boolean(card && hints[card.id])
    if (!signedIn) { onSignIn(); return false }
    if (!window.confirm('Spend 1 credit to generate a hint for this flashcard?')) return false
    setLoadingHintId(card.id); setAiError(undefined)
    try { const result = await generateMaterialFlashcardHint(subject, card); onBalance(result.balance); setHints((current) => ({ ...current, [card.id]: result.hint })); return true }
    catch (cause) { if (cause instanceof AIActionError && cause.balance) onBalance(cause.balance); if (cause instanceof AIActionError && cause.code === 'insufficient_credits') onInsufficientCredits('A flashcard hint', 1); else setAiError(cause instanceof Error ? cause.message : 'The hint could not be generated. No credit was charged.'); return false }
    finally { setLoadingHintId(undefined) }
  }
  useEffect(() => { actionHandler.current = async (action) => {
    if (!card) return { ok: false, error: 'The flashcard is still loading.' }
    if (action.type === 'flashcard.side') { setRevealed(action.side === 'answer'); return { ok: true, message: `${action.side === 'answer' ? 'Answer' : 'Question'} shown.` } }
    if (action.type === 'flashcard.navigate') { const next = index + (action.direction === 'next' ? 1 : -1); if (next < 0 || next >= order.length) return { ok: false, error: `There is no ${action.direction} card.` }; navigate(next); return { ok: true, message: `Moved to card ${next + 1}.` } }
    if (action.type === 'flashcard.shuffle') { shuffle(); return { ok: true, message: 'Deck shuffled.' } }
    if (action.type === 'materialFlashcard.hint') { if (hints[card.id]) return { ok: true, message: 'The hint is already visible.' }; return await requestHint() ? { ok: true, message: 'The hint is now visible on the question side.' } : { ok: false, error: 'The hint was not generated.' } }
    if (!revealed) return { ok: false, error: 'Reveal the answer before grading this card.' }
    return gradeCurrent(action.grade) ? { ok: true, message: `Card graded ${action.grade}.` } : { ok: false, error: 'This card has already been graded.' }
  } })
  useEffect(() => { if (!card) return; const state: MaterialFlashcardVoiceState = { target: 'material-flashcards', subject: subject.title, deckId: `materials:${subject.releaseId}`, cardId: card.id, index, count: order.length, side: revealed ? 'answer' : 'question', graded, question: { heading: card.section || 'Question', body: materialFlashcardFace(card, false) }, answer: revealed ? { heading: 'Answer', body: materialFlashcardFace(card, true) } : undefined, hint: hints[card.id] }; onLearningState(state); return () => onLearningState(undefined) }, [card, graded, hints, index, onLearningState, order.length, revealed, subject.releaseId, subject.title])
  if (error) return <Failure message={error} retry={() => { setError(undefined); setReload((value) => value + 1) }} />
  if (!cards) return <Loading />
  if (!card) return <div className="materials-state">No flashcards are available for this subject yet.</div>
  const reviewed = cards.filter((entry) => progress?.cards[entry.id]).length
  return <div className="material-card-study"><header><div><strong>{reviewed}/{cards.length} reviewed</strong><Progress value={(reviewed / cards.length) * 100} /></div><div><Button variant="ghost" onClick={() => void requestHint()} disabled={Boolean(hints[card.id]) || Boolean(loadingHintId)}><Lightbulb />{hints[card.id] ? 'Hint unlocked' : loadingHintId === card.id ? 'Generating...' : signedIn ? 'Hint · 1 credit' : 'Sign in for hint'}</Button><Button variant="ghost" onClick={shuffle}><Shuffle />Shuffle</Button></div></header>{aiError && <div className="ai-action-error" role="alert"><span>{aiError}</span></div>}<div className="material-card-nav"><Button variant="ghost" size="sm" disabled={index === 0} onClick={() => navigate(index - 1)}><ArrowLeft />Previous</Button><span>Card {index + 1} of {cards.length}</span><Button variant="ghost" size="sm" disabled={index === cards.length - 1} onClick={() => navigate(index + 1)}>Next<ArrowRight /></Button></div><Card className={`material-card-stage ${revealed ? 'flipped' : ''}`}><div className="material-card-inner"><div className="material-card-face material-card-front" aria-hidden={revealed} inert={revealed ? true : undefined}><span>Question</span><MaterialMarkdown markdown={materialFlashcardFace(card, false)} mnemonics={new Map()} />{hints[card.id] && <div className="assessment-hint"><Lightbulb /><div><strong>Hint</strong><p>{hints[card.id]}</p></div></div>}</div><div className="material-card-face material-card-back" aria-hidden={!revealed} inert={!revealed ? true : undefined}><span>Answer</span><MaterialMarkdown markdown={materialFlashcardFace(card, true)} mnemonics={new Map()} /></div></div></Card><div className="material-card-actions">{revealed && <div aria-label="Grade this card">{(['again', 'hard', 'good', 'easy'] as const).map((grade) => <Button key={grade} variant="grade" disabled={graded} onClick={() => gradeCurrent(grade)}>{grade[0].toUpperCase() + grade.slice(1)}</Button>)}</div>}<Button size="lg" onClick={() => setRevealed((value) => !value)} aria-expanded={revealed}>{revealed ? <><RotateCcw />Show question</> : <><Eye />Reveal answer</>}</Button></div></div>
}

function MaterialPractice({ subject, signedIn, creditBalance, onBalance, onInsufficientCredits, onSignIn, onLearningState, onLearningController }: LearningProps & { subject: MaterialSubject }) {
  const [questions, setQuestions] = useState<MaterialQuestion[]>(), [index, setIndex] = useState(0), [answers, setAnswers] = useState<Record<string, number>>({}), [submitted, setSubmitted] = useState(false)
  const [hints, setHints] = useState<Record<string, string>>({}), [corrections, setCorrections] = useState<string[]>(), [loadingHintId, setLoadingHintId] = useState<string>(), [loadingCorrections, setLoadingCorrections] = useState(false)
  const [aiError, setAiError] = useState<string>(), [error, setError] = useState<string>(), [reload, setReload] = useState(0)
  const actionHandler = useRef<(action: Extract<VoiceAction, { type: `assessment.${string}` }>) => Promise<VoiceActionResult>>(async () => ({ ok: false, error: 'The practice test is still loading.' }))
  useEffect(() => { let current = true; listMaterialQuestions(subject.releaseId).then((rows) => { if (!current) return; if (rows.length < 20) setError('This practice test does not contain the required 20 questions.'); else setQuestions(rows.slice(0, 20)) }).catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : 'Practice questions could not be loaded.') }); return () => { current = false } }, [reload, subject.releaseId])
  useEffect(() => { const controller: MaterialLearningController = { target: 'material-practice', executeVoiceAction: (action) => actionHandler.current(action as Extract<VoiceAction, { type: `assessment.${string}` }>) }; onLearningController(controller); return () => onLearningController(undefined) }, [onLearningController])
  const question = questions?.[index], answered = Object.keys(answers).length
  async function requestHint() {
    if (!question || submitted || hints[question.id] || loadingHintId) return Boolean(question && hints[question.id])
    if (!signedIn) { onSignIn(); return false }
    if (!window.confirm('Spend 1 credit to generate a hint for this question?')) return false
    setLoadingHintId(question.id); setAiError(undefined)
    try { const result = await generateMaterialQuestionHint(subject, question); onBalance(result.balance); setHints((current) => ({ ...current, [question.id]: result.hint })); return true }
    catch (cause) { if (cause instanceof AIActionError && cause.balance) onBalance(cause.balance); if (cause instanceof AIActionError && cause.code === 'insufficient_credits') onInsufficientCredits('A material assessment hint', 1); else setAiError(cause instanceof Error ? cause.message : 'The hint could not be generated. No credit was charged.'); return false }
    finally { setLoadingHintId(undefined) }
  }
  function submit() { if (!questions || answered !== questions.length || submitted) return false; setSubmitted(true); return true }
  async function requestCorrections() {
    if (!questions || !submitted || corrections || loadingCorrections) return
    if (!signedIn) { onSignIn(); return }
    if (!window.confirm('Spend 2 credits to unlock correct answers and AI explanations?')) return
    setLoadingCorrections(true); setAiError(undefined)
    try { const result = await generateMaterialCorrections(subject, questions, questions.map((entry) => answers[entry.id] ?? null)); onBalance(result.balance); setCorrections(result.corrections); setIndex(0) }
    catch (cause) { if (cause instanceof AIActionError && cause.balance) onBalance(cause.balance); if (cause instanceof AIActionError && cause.code === 'insufficient_credits') onInsufficientCredits('Material assessment corrections', 2); else setAiError(cause instanceof Error ? cause.message : 'Corrections could not be generated. No credit was charged.') }
    finally { setLoadingCorrections(false) }
  }
  useEffect(() => { actionHandler.current = async (action) => {
    if (!questions || !question) return { ok: false, error: 'The practice test is still loading.' }
    if (action.type === 'assessment.select') { if (submitted) return { ok: false, error: 'This assessment has already been submitted.' }; if (action.optionIndex < 0 || action.optionIndex >= question.options.length) return { ok: false, error: 'That option is not available.' }; setAnswers((current) => ({ ...current, [question.id]: action.optionIndex })); return { ok: true, message: `Option ${String.fromCharCode(65 + action.optionIndex)} selected for question ${index + 1}.` } }
    if (action.type === 'assessment.navigate') { const next = index + (action.direction === 'next' ? 1 : -1); if (next < 0 || next >= questions.length) return { ok: false, error: `There is no ${action.direction} question.` }; setIndex(next); return { ok: true, message: `Moved to question ${next + 1}.` } }
    if (action.type === 'assessment.hint') { if (submitted) return { ok: false, error: 'Hints are unavailable after submission.' }; if (hints[question.id]) return { ok: true, message: 'The hint is already visible.' }; return await requestHint() ? { ok: true, message: 'The hint is now visible.' } : { ok: false, error: 'The hint was not generated.' } }
    if (submitted) return { ok: false, error: 'This assessment has already been submitted.' }
    if (answered !== questions.length) return { ok: false, error: 'Answer every question before submitting.' }
    if (!window.confirm('Submit this assessment for final grading?')) return { ok: false, error: 'The learner did not confirm assessment submission.' }
    submit(); return { ok: true, message: 'Assessment submitted.' }
  } })
  useEffect(() => { if (!questions || !question) return; onLearningState({ target: 'material-practice', subject: subject.title, questionId: question.id, index, count: questions.length, question: question.question, options: [...question.options], selectedIndex: answers[question.id] ?? null, submitted, hint: hints[question.id] }); return () => onLearningState(undefined) }, [answers, hints, index, onLearningState, question, questions, subject.title, submitted])
  if (error) return <Failure message={error} retry={() => { setError(undefined); setReload((value) => value + 1) }} />
  if (!questions || !question) return <Loading />
  const selected = answers[question.id], score = submitted ? questions.filter((entry) => answers[entry.id] === entry.answerIndex).length : 0, percentage = Math.round((score / questions.length) * 100), correction = corrections?.[index]
  return <div className="material-practice assessment-view">{aiError && <div className="ai-action-error" role="alert"><span>{aiError}</span></div>}{submitted && !corrections ? <section className="assessment-result" aria-live="polite"><div><span>Assessment submitted</span><strong>{percentage}%</strong><p>{score} of {questions.length} questions correct</p></div><div><h2>{percentage >= 70 ? 'Strong result.' : 'Keep building.'}</h2><p>Your score is final for this attempt. Unlock detailed AI corrections to review every answer.</p><small>{signedIn ? creditBalance === undefined ? 'Loading credits' : `${creditBalance} credits available` : 'Sign in to use AI assessment tools.'}</small><div><Button variant="ai" onClick={() => void requestCorrections()} disabled={loadingCorrections}>{loadingCorrections ? 'Preparing corrections...' : signedIn ? 'See AI corrections · 2 credits' : 'Sign in for corrections'}</Button></div></div></section> : <div className="assessment-workspace"><Card className="assessment-navigator"><header><div><span>Progress</span><strong>{answered}/{questions.length}</strong></div><Progress value={(answered / questions.length) * 100} /></header><div className="assessment-question-grid" aria-label="Assessment questions">{questions.map((entry, questionIndex) => <button key={entry.id} className={`${questionIndex === index ? 'active' : ''} ${answers[entry.id] !== undefined ? 'complete' : ''}`} onClick={() => setIndex(questionIndex)} aria-label={`Question ${questionIndex + 1}${answers[entry.id] !== undefined ? ', answered' : ', unanswered'}`} aria-current={questionIndex === index ? 'step' : undefined}>{questionIndex + 1}</button>)}</div><footer><span><i className="answered" />Answered</span><span><i className="current" />Current</span></footer></Card><Card className="quiz-stage assessment-stage"><header><div><span className="question-number">{index + 1}</span><strong>Question {index + 1} of {questions.length}</strong></div><div>{!submitted && <Button variant="ghost" size="sm" className="hint-button" onClick={() => void requestHint()} disabled={Boolean(loadingHintId) || Boolean(hints[question.id])}><Lightbulb />{hints[question.id] ? 'Hint unlocked' : loadingHintId === question.id ? 'Generating...' : signedIn ? 'Hint · 1 credit' : 'Sign in for hint'}</Button>}</div></header><div className="assessment-question-copy"><h2>{question.question}</h2></div><fieldset disabled={submitted}>{question.options.map((option, optionIndex) => { const correct = Boolean(corrections) && optionIndex === question.answerIndex, isSelected = selected === optionIndex; return <label key={optionIndex} className={`${isSelected ? 'selected' : ''} ${corrections ? `${correct ? 'correction-correct' : ''} ${isSelected && !correct ? 'correction-selected' : ''}` : ''}`}><input type="radio" name={`material-question-${question.id}`} checked={isSelected} onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))} /><span>{String.fromCharCode(65 + optionIndex)}</span><b>{option}</b>{correct && <Check />}</label> })}</fieldset>{hints[question.id] && <div className="assessment-hint"><Lightbulb /><div><strong>Hint</strong><p>{hints[question.id]}</p></div></div>}{correction && <div className="assessment-correction"><span>AI correction</span><h3>{selected === question.answerIndex ? 'Your answer was correct.' : `Correct answer: ${question.options[question.answerIndex]}`}</h3><p>{correction}</p><small>{question.explanation}</small></div>}<footer><Button variant="ghost" onClick={() => setIndex(index - 1)} disabled={index === 0}><ArrowLeft />Previous</Button><span>{answered} answered</span><div>{index < questions.length - 1 && <Button onClick={() => setIndex(index + 1)}>Next<ArrowRight /></Button>}{!submitted && answered === questions.length && <Button onClick={submit}>Submit assessment</Button>}</div></footer></Card></div>}</div>
}

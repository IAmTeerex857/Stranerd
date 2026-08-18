import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Book, Check, ClipboardList, Eye, GalleryVerticalEnd, LayoutGrid, Lightbulb, RotateCcw, ScanLine, Search, Shuffle, Zap } from 'lucide-react'
import type { FlashcardDeckProgress, FlashcardGrade, MaterialReleaseProgress } from '../types'
import type { ActiveNoteContext, LibraryContentMode, MaterialCatalogRegistration, MaterialFlashcard, MaterialFlashcardVoiceState, MaterialImageMetadata, MaterialLearningController, MaterialLearningState, MaterialMnemonic, MaterialQuestion, MaterialSection, MaterialSectionSummary, MaterialSubject } from '../types/materials'
import { getMaterialSection, isHeadingOnlyMaterialSection, listMaterialAssetMetadata, listMaterialFlashcards, listMaterialMnemonics, listMaterialQuestions, listMaterialSections, listMaterialSubjects, materialFlashcardFace, submitMaterialQuestions } from '../lib/materials'
import { materialCatalogDecks } from '../lib/materialCatalog'
import { flashcardGradeTransition, shuffledIds } from '../lib/flashcards'
import { generateMaterialCorrections, generateMaterialFlashcardHint, generateMaterialQuestionHint } from '../lib/quiz'
import { AIActionError, type CreditBalance } from '../lib/ai'
import type { VoiceAction, VoiceActionResult } from '../lib/voiceActions'
import { MaterialMarkdown } from './MaterialMarkdown'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'

const subjectThemes: Record<
  string,
  {
    from: string
    to: string
    system: string
    scientific: string
    region: string
  }
> = {
  heart: {
    from: '#F0567A',
    to: '#C0324F',
    system: 'Cardiovascular',
    scientific: 'Cor',
    region: 'Thorax',
  },
  brain: {
    from: '#4C6EF0',
    to: '#2E45C2',
    system: 'Nervous',
    scientific: 'Encephalon',
    region: 'Cranial cavity',
  },
  lungs: {
    from: '#12A6C9',
    to: '#0C7C9E',
    system: 'Respiratory',
    scientific: 'Pulmones',
    region: 'Thorax',
  },
  kidney: {
    from: '#E39A2B',
    to: '#C0761A',
    system: 'Urinary',
    scientific: 'Ren',
    region: 'Posterior abdomen',
  },
  eye: {
    from: '#14A58F',
    to: '#0C7E74',
    system: 'Sensory',
    scientific: 'Oculus',
    region: 'Orbit',
  },
  liver: {
    from: '#B5772F',
    to: '#8F571E',
    system: 'Digestive',
    scientific: 'Hepar',
    region: 'Right upper abdomen',
  },
  'nervous-system': {
    from: '#3F73F2',
    to: '#2C50CE',
    system: 'Nervous',
    scientific: 'Systema nervosum',
    region: 'Whole body',
  },
  skin: {
    from: '#D98A63',
    to: '#B96543',
    system: 'Integumentary',
    scientific: 'Cutis',
    region: 'Body surface',
  },
  anatomy: {
    from: '#64788F',
    to: '#435469',
    system: 'Whole Body',
    scientific: 'Corpus humanum',
    region: 'Whole body',
  },
  'digestive-system': {
    from: '#2FAA69',
    to: '#1E8A52',
    system: 'Digestive',
    scientific: 'Systema digestorium',
    region: 'Thorax to pelvis',
  },
}

const fallbackThemes = Object.values(subjectThemes)

function resetNoteScroll(scroller: HTMLElement | null) {
  if (!scroller) return
  const scrollBehavior = scroller.style.scrollBehavior
  scroller.style.scrollBehavior = 'auto'
  scroller.scrollTop = 0
  scroller.style.scrollBehavior = scrollBehavior
}

function subjectKey(subject: MaterialSubject) {
  const value = `${subject.slug} ${subject.title}`.toLowerCase()
  return Object.keys(subjectThemes).find((key) => value.includes(key.replace('-', ' '))) ?? subject.slug
}

function subjectTheme(subject: MaterialSubject, index: number) {
  return (
    subjectThemes[subjectKey(subject)] ?? {
      ...fallbackThemes[index % fallbackThemes.length],
      system: subject.title,
    }
  )
}

type Props = {
  mode: LibraryContentMode
  progressByDeck: Record<string, FlashcardDeckProgress>
  materialProgressByRelease: Record<string, MaterialReleaseProgress>
  onGrade: (subject: MaterialSubject, cardId: string, grade: FlashcardGrade) => void
  onProgress: (subject: MaterialSubject, progress: Partial<MaterialReleaseProgress>) => void
  onSubjectChange: (subject?: MaterialSubject) => void
  onNoteContext: (context?: ActiveNoteContext) => void
  onNoteRequest: (prompt: string) => void
  signedIn: boolean
  creditBalance?: number
  onBalance: (balance: CreditBalance) => void
  onInsufficientCredits: (action: string, required: number) => void
  onSignIn: (next?: string) => void
  onLearningState: (state?: MaterialLearningState) => void
  onLearningController: (controller?: MaterialLearningController) => void
  onCatalog: (registration?: MaterialCatalogRegistration) => void
}

type LearningProps = Pick<Props, 'signedIn' | 'creditBalance' | 'onBalance' | 'onInsufficientCredits' | 'onSignIn' | 'onLearningState' | 'onLearningController'>

function Loading() {
  return (
    <div className="materials-state" role="status">
      Loading materials...
    </div>
  )
}
function Failure({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="materials-state error" role="alert">
      <p>{message}</p>
      <Button variant="outline" onClick={retry}>
        Try again
      </Button>
    </div>
  )
}

export default function MaterialsView(props: Props) {
  const { mode, progressByDeck, materialProgressByRelease, onGrade, onSubjectChange, onNoteContext, onCatalog, onSignIn, signedIn } = props
  const [subjects, setSubjects] = useState<MaterialSubject[]>()
  const [subject, setSubject] = useState<MaterialSubject>()
  const [query, setQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [error, setError] = useState<string>()
  const [reload, setReload] = useState(0)
  const pendingCatalogOpens = useRef<{ releaseId: string; timeout: number; resolve: (opened: boolean) => void }[]>([])
  const notifySubjectChange = useEffectEvent(onSubjectChange)
  const notifyCatalog = useEffectEvent(onCatalog)
  const requireSignIn = useEffectEvent(onSignIn)
  const learningStateHandler = useRef(props.onLearningState)
  useEffect(() => { learningStateHandler.current = props.onLearningState }, [props.onLearningState])
  useEffect(() => {
    let current = true
    listMaterialSubjects()
      .then((rows) => {
        if (!current) return
        setSubjects(rows)
        const requested = new URLSearchParams(window.location.search).get('subject')
        const next = signedIn && requested ? rows.find((entry) => entry.slug === requested) : undefined
        setSubject(next)
        notifySubjectChange(next)
      })
      .catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : 'Materials could not be loaded.')
      })
    return () => {
      current = false
    }
  }, [reload, signedIn])
  const ordered = useMemo(() => subjects ? [...subjects].sort((a, b) => Object.keys(subjectThemes).indexOf(subjectKey(a)) - Object.keys(subjectThemes).indexOf(subjectKey(b))) : [], [subjects])
  const catalogState = useMemo(() => ({ decks: materialCatalogDecks(ordered), activeReleaseId: subject?.releaseId }), [ordered, subject?.releaseId])
  const reportLearningState = useCallback((state?: MaterialLearningState) => {
    learningStateHandler.current(state)
    if (state?.target !== 'material-flashcards') return
    const releaseId = state.deckId.replace(/^materials:/, '')
    const completed = pendingCatalogOpens.current.filter((entry) => entry.releaseId === releaseId)
    pendingCatalogOpens.current = pendingCatalogOpens.current.filter((entry) => entry.releaseId !== releaseId)
    completed.forEach(({ timeout, resolve }) => { window.clearTimeout(timeout); resolve(true) })
  }, [])
  useLayoutEffect(() => {
    notifyCatalog({
      state: catalogState,
      controller: {
        openRelease: (releaseId) => {
          const next = ordered.find((entry) => entry.releaseId === releaseId)
          if (!next) return Promise.resolve(false)
          if (!signedIn) {
            const url = new URL(window.location.href)
            url.searchParams.set('content', mode)
            url.searchParams.set('subject', next.slug)
            requireSignIn(`${url.pathname}${url.search}${url.hash}`)
            return Promise.resolve(false)
          }
           return new Promise<boolean>((resolve) => {
            const timeout = window.setTimeout(() => {
              pendingCatalogOpens.current = pendingCatalogOpens.current.filter((entry) => entry.resolve !== resolve)
              resolve(false)
            }, 10_000)
            pendingCatalogOpens.current.push({ releaseId, timeout, resolve })
            setSubject(next)
            notifySubjectChange(next)
            const url = new URL(window.location.href)
            url.searchParams.set('content', mode)
            url.searchParams.set('subject', next.slug)
            window.history.replaceState({}, '', url)
          })
        },
      },
    })
  }, [catalogState, mode, ordered, signedIn])
  useEffect(() => () => {
    pendingCatalogOpens.current.forEach(({ timeout, resolve }) => { window.clearTimeout(timeout); resolve(false) })
    pendingCatalogOpens.current = []
    notifyCatalog(undefined)
  }, [])
  function selectSubject(next?: MaterialSubject) {
    if (next && !signedIn) {
      const url = new URL(window.location.href)
      url.searchParams.set('content', mode)
      url.searchParams.set('subject', next.slug)
      onSignIn(`${url.pathname}${url.search}${url.hash}`)
      return
    }
    setSubject(next)
    onSubjectChange(next)
    if (!next) onNoteContext(undefined)
    const url = new URL(window.location.href)
    url.searchParams.set('content', mode)
    if (next) url.searchParams.set('subject', next.slug)
    else url.searchParams.delete('subject')
    window.history.replaceState({}, '', url)
  }
  if (error)
    return (
      <Failure
        message={error}
        retry={() => {
          setError(undefined)
          setReload((value) => value + 1)
        }}
      />
    )
  if (!subjects) return <Loading />
  if (subject) {
    const progress = progressByDeck[`materials:${subject.releaseId}`]
    const materialProgress = materialProgressByRelease[subject.releaseId]
    return <SubjectMaterials mode={mode} signedIn={props.signedIn} creditBalance={props.creditBalance} onBalance={props.onBalance} onInsufficientCredits={props.onInsufficientCredits} onSignIn={props.onSignIn} onLearningState={reportLearningState} onLearningController={props.onLearningController} subject={subject} progress={progress?.contentVersion === subject.contentVersion ? progress : undefined} materialProgress={materialProgress?.contentVersion === subject.contentVersion ? materialProgress : undefined} onProgress={props.onProgress} onNoteContext={props.onNoteContext} onNoteRequest={props.onNoteRequest} onCardGrade={(cardId, grade) => onGrade(subject, cardId, grade)} onBack={() => selectSubject(undefined)} />
  }
  const normalized = query.trim().toLowerCase()
  const filtered = ordered.filter((entry) => {
    const theme = subjectThemes[subjectKey(entry)]
    return (subjectFilter === 'all' || entry.id === subjectFilter) && `${entry.title} ${theme?.system ?? ''} ${theme?.scientific ?? ''} ${theme?.region ?? ''}`.toLowerCase().includes(normalized)
  })
  const copy =
    mode === 'notes'
      ? {
          heading: 'Notes by subject',
          placeholder: 'Search subjects',
          Icon: Book,
        }
      : mode === 'practice'
        ? {
            heading: 'Practice tests',
            placeholder: 'Search practice tests',
            Icon: ClipboardList,
          }
        : {
            heading: 'Flashcard sets',
            placeholder: 'Search flashcard sets',
            Icon: GalleryVerticalEnd,
          }
  return (
    <section className={`materials-catalog materials-catalog-${mode}`} aria-labelledby="materials-heading">
      <label className="library-search materials-search">
        <span className="sr-only">{copy.placeholder}</span>
        <Search aria-hidden="true" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.placeholder} />
      </label>
      <div className="material-subject-filters" aria-label="Filter by subject">
        <button type="button" className={subjectFilter === 'all' ? 'active' : ''} onClick={() => setSubjectFilter('all')}>
          <i className="all-subjects-dot" />
          <span>All subjects</span>
        </button>
        {ordered.map((entry, index) => {
          const theme = subjectTheme(entry, index)
          return (
            <button type="button" key={entry.id} className={subjectFilter === entry.id ? 'active' : ''} title={entry.title} onClick={() => setSubjectFilter(subjectFilter === entry.id ? 'all' : entry.id)}>
              <i style={{ background: theme.from }} />
              <span>{entry.title}</span>
            </button>
          )
        })}
      </div>
      <div className="materials-collection-heading">
        <h2 id="materials-heading">{copy.heading}</h2>
        <span>{filtered.length} subjects</span>
      </div>
      {filtered.length ? (
        mode === 'practice' ? (
          <div className="material-practice-list">
            {filtered.map((entry) => {
              const theme = subjectTheme(entry, ordered.indexOf(entry))
              const progress = materialProgressByRelease[entry.releaseId]
              const answered = progress?.contentVersion === entry.contentVersion ? Object.keys(progress.practiceAnswers).length : 0
              const total = Math.min(20, entry.counts.questions)
              const action = progress?.practiceSubmitted ? 'Review' : answered > 0 ? 'Continue' : 'Start'
              return (
                <article key={entry.id} style={{ '--subject-color': theme.from } as CSSProperties}>
                  <span className="material-practice-icon" aria-hidden="true">
                    <ClipboardList />
                  </span>
                  <div>
                    <h3>{entry.title}</h3>
                    <p>
                      <b>{entry.counts.questions} questions</b>
                      <i />
                      {progress?.practiceSubmitted ? 'Completed' : answered ? `${answered}/${total} answered` : 'Not attempted'}
                    </p>
                  </div>
                  <Button variant={answered ? 'default' : 'outline'} onClick={() => selectSubject(entry)} aria-label={`${action} ${entry.title} practice test`}>
                    <span>{action}</span>
                    <ArrowRight />
                  </Button>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="materials-grid">
            {filtered.map((entry) => {
              const theme = subjectTheme(entry, ordered.indexOf(entry))
              const count = mode === 'notes' ? entry.counts.sections : entry.counts.flashcards
              const unit = mode === 'notes' ? 'sections' : 'cards'
              const saved = progressByDeck[`materials:${entry.releaseId}`]
              const materialProgress = materialProgressByRelease[entry.releaseId]
              const completed = mode === 'notes'
                ? materialProgress?.contentVersion === entry.contentVersion ? materialProgress.readSectionIds.length : 0
                : saved?.contentVersion === entry.contentVersion ? Object.values(saved.cards).filter((card) => card.grade && card.grade !== 'again').length : 0
              const percent = count ? Math.round((completed / count) * 100) : 0
              const started = completed > 0
              const action = completed >= count && count > 0 ? 'Review' : started ? 'Continue' : mode === 'notes' ? 'Read' : 'Study'
              return (
                <Card
                  key={entry.id}
                  className={`material-subject-card material-subject-card-${mode}`}
                  style={
                    {
                      '--subject-from': theme.from,
                      '--subject-to': theme.to,
                    } as CSSProperties
                  }
                >
                  <header className="material-subject-cover">
                    <span>{theme.system}</span>
                    <span className="material-cover-icon" aria-hidden="true">
                      <copy.Icon />
                    </span>
                    <div>
                      <h3>{entry.title}</h3>
                      <em>{theme.scientific}</em>
                    </div>
                  </header>
                  <div className="material-subject-body">
                    <p>
                      <b>
                        {count} {unit}
                      </b>
                      <i />
                      {theme.region}
                    </p>
                    <div className="material-catalog-progress">
                      <span>
                        {started ? `${completed} of ${count} ${mode === 'notes' ? 'read' : 'reviewed'}` : 'Not started'}
                        <b>{percent}%</b>
                      </span>
                      <Progress value={percent} aria-label={`${percent}% complete`} />
                    </div>
                    <Button variant={started ? 'default' : 'outline'} className={started ? 'started' : ''} onClick={() => selectSubject(entry)} aria-label={`${action} ${entry.title}`}>
                      {action}
                      <ArrowRight />
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      ) : (
        <div className="empty-state">No subjects match these filters.</div>
      )}
    </section>
  )
}

function SubjectMaterials({
  mode,
  subject,
  progress,
  onCardGrade,
  onNoteContext,
  onNoteRequest,
  onBack,
  materialProgress,
  onProgress,
  ...learning
}: LearningProps & {
  mode: LibraryContentMode
  subject: MaterialSubject
  progress?: FlashcardDeckProgress
  materialProgress?: MaterialReleaseProgress
  onProgress: Props['onProgress']
  onCardGrade: (cardId: string, grade: FlashcardGrade) => void
  onNoteContext: Props['onNoteContext']
  onNoteRequest: Props['onNoteRequest']
  onBack: () => void
}) {
  useEffect(() => {
    if (mode !== 'notes') onNoteContext(undefined)
  }, [mode, onNoteContext])
  return (
    <section className={`subject-materials subject-materials-${mode}`} aria-labelledby="subject-materials-heading">
      <header className="subject-materials-header">
        <Button variant="ghost" className="library-back" onClick={onBack}>
          <ArrowLeft />
          All {mode === 'practice' ? 'practice tests' : mode}
        </Button>
        <div>
          <span className="page-kicker">{mode === 'practice' ? 'Practice test' : mode}</span>
          <h2 id="subject-materials-heading">{subject.title}</h2>
        </div>
      </header>
      {!learning.signedIn ? <div className="materials-state"><p>Sign in to access these learning materials.</p><Button onClick={() => learning.onSignIn()}>Sign in</Button></div> : <>
        {mode === 'notes' && <MaterialNotes subject={subject} progress={materialProgress} onProgress={onProgress} onNoteContext={onNoteContext} onNoteRequest={onNoteRequest} />}
        {mode === 'flashcards' && <MaterialCards subject={subject} progress={progress} {...learning} onGrade={onCardGrade} />}
        {mode === 'practice' && <MaterialPractice subject={subject} progress={materialProgress} onProgress={onProgress} onBack={onBack} {...learning} />}
      </>}
    </section>
  )
}

function MaterialNotes({ subject, progress, onProgress, onNoteContext, onNoteRequest }: { subject: MaterialSubject; progress?: MaterialReleaseProgress; onProgress: Props['onProgress']; onNoteContext: Props['onNoteContext']; onNoteRequest: Props['onNoteRequest'] }) {
  const initialProgress = useRef(progress)
  const reportProgress = useEffectEvent((readSectionIds: string[]) => onProgress(subject, { readSectionIds }))
  const [sections, setSections] = useState<MaterialSectionSummary[]>()
  const [section, setSection] = useState<MaterialSection>()
  const [mnemonics, setMnemonics] = useState<MaterialMnemonic[]>([])
  const [imageMetadata, setImageMetadata] = useState<Map<string, MaterialImageMetadata>>(new Map())
  const [selectedId, setSelectedId] = useState<string>()
  const [error, setError] = useState<string>()
  const [reload, setReload] = useState(0)
  const noteScroller = useRef<HTMLElement>(null)
  const noteHeading = useRef<HTMLHeadingElement>(null)
  const focusChangedSection = useRef(false)
  const progressRef = useRef(progress)
  useEffect(() => { progressRef.current = progress }, [progress])
  useEffect(() => {
    let current = true
    Promise.all([listMaterialSections(subject.releaseId), listMaterialMnemonics(subject.releaseId), listMaterialAssetMetadata(subject.releaseId)])
      .then(([nextSections, nextMnemonics, nextImageMetadata]) => {
        if (current) {
          setSections(nextSections)
          setMnemonics(nextMnemonics)
          setImageMetadata(nextImageMetadata)
          setSelectedId(nextSections.find((entry) => !initialProgress.current?.readSectionIds.includes(entry.id))?.id ?? nextSections[0]?.id)
        }
      })
      .catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : 'Notes could not be loaded.')
      })
    return () => {
      current = false
    }
  }, [reload, subject.releaseId])
  useEffect(() => {
    if (!selectedId) return
    let current = true
    getMaterialSection(subject.releaseId, selectedId)
      .then((row) => {
        if (current) {
          setSection(row)
          const currentProgress = progressRef.current
          if (!currentProgress?.readSectionIds.includes(row.id)) reportProgress([...(currentProgress?.readSectionIds ?? []), row.id])
        }
      })
      .catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : 'This section could not be loaded.')
      })
    return () => {
      current = false
    }
  }, [reload, selectedId, subject.releaseId])
  useEffect(() => {
    if (section)
      onNoteContext({
        subject: subject.title,
        subjectSlug: subject.slug,
        releaseId: subject.releaseId,
        sectionId: section.id,
        section: section.title,
        pageStart: section.pageStart,
        pageEnd: section.pageEnd,
        selectedText: '',
      })
  }, [onNoteContext, section, subject.releaseId, subject.slug, subject.title])
  useLayoutEffect(() => {
    if (!section || section.id !== selectedId) return
    resetNoteScroll(noteScroller.current)
    if (focusChangedSection.current) {
      noteHeading.current?.focus({ preventScroll: true })
      focusChangedSection.current = false
    }
  }, [section, selectedId])
  if (error)
    return (
      <Failure
        message={error}
        retry={() => {
          setError(undefined)
          setReload((value) => value + 1)
        }}
      />
    )
  if (!sections) return <Loading />
  if (!sections.length) return <div className="materials-state">No notes are available for this subject yet.</div>
  const mnemonicMap = new Map(mnemonics.map((entry) => [entry.id, entry]))
  const context = section
    ? {
        subject: subject.title,
        subjectSlug: subject.slug,
        releaseId: subject.releaseId,
        sectionId: section.id,
        section: section.title,
        pageStart: section.pageStart,
        pageEnd: section.pageEnd,
      }
    : undefined
  function selectSection(id: string) {
    if (id === selectedId) return
    focusChangedSection.current = true
    resetNoteScroll(noteScroller.current)
    setSection(undefined)
    setSelectedId(id)
  }
  const headingOnly = section ? isHeadingOnlyMaterialSection(section.content) : false
  return (
    <div className="material-notes-layout">
      <aside className="material-section-list" aria-label={`${subject.title} sections`}>
        <div className="material-section-title">
          {subject.title}
          <span>Sections</span>
        </div>
        <nav aria-label="Note sections">
          {sections.map((entry) => (
            <button type="button" key={entry.id} className={selectedId === entry.id ? 'active' : ''} onClick={() => selectSection(entry.id)} aria-current={selectedId === entry.id ? 'page' : undefined}>
              <span>{entry.ordinal + 1}</span>
              <b>{entry.title}</b>
            </button>
          ))}
        </nav>
      </aside>
      <article ref={noteScroller} className={`material-note${headingOnly ? ' material-note-divider' : ''}`}>
        {section && context ? (
          <>
            <header>
              <span>
                {subject.title} · pages {section.pageStart}
                {section.pageEnd !== section.pageStart ? `–${section.pageEnd}` : ''}
              </span>
              <h1 ref={noteHeading} tabIndex={-1}>{section.title}</h1>
            </header>
            <MaterialMarkdown markdown={section.content} mnemonics={mnemonicMap} noteContext={context} onSelection={(selectedText) => onNoteContext({ ...context, selectedText })} onRequest={onNoteRequest} imageMetadata={imageMetadata} />
          </>
        ) : (
          <Loading />
        )}
      </article>
    </div>
  )
}

function MaterialCards({
  subject,
  progress,
  onGrade,
  signedIn,
  onBalance,
  onInsufficientCredits,
  onSignIn,
  onLearningState,
  onLearningController,
}: LearningProps & {
  subject: MaterialSubject
  progress?: FlashcardDeckProgress
  onGrade: (cardId: string, grade: FlashcardGrade) => void
}) {
  const initialProgress = useRef(progress)
  const progressHydrated = useRef(Boolean(progress))
  const [cards, setCards] = useState<MaterialFlashcard[]>(),
    [order, setOrder] = useState<string[]>([]),
    [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false),
    [graded, setGraded] = useState(false),
    [hints, setHints] = useState<Record<string, string>>({})
  const [loadingHintId, setLoadingHintId] = useState<string>(),
    [aiError, setAiError] = useState<string>(),
    [error, setError] = useState<string>(),
    [reload, setReload] = useState(0)
  const cardsRef = useRef<MaterialFlashcard[]>([])
  const orderRef = useRef<string[]>([])
  const indexRef = useRef(0)
  const revealedRef = useRef(false)
  const gradedRef = useRef(false)
  const hintsRef = useRef<Record<string, string>>({})
  const loadingHintRef = useRef<string | undefined>(undefined)
  const actionHandler = useRef<(action: Extract<VoiceAction, { type: `flashcard.${string}` | `materialFlashcard.${string}` }>) => Promise<VoiceActionResult>>(async () => ({ ok: false, error: 'The flashcard is still loading.' }))
  useEffect(() => {
    let current = true
    listMaterialFlashcards(subject.releaseId)
      .then((rows) => {
        if (current) {
          cardsRef.current = rows
          orderRef.current = rows.map((entry) => entry.id)
          setCards(rows)
          setOrder(orderRef.current)
          const firstUnreviewed = rows.findIndex((entry) => !initialProgress.current?.cards[entry.id] || initialProgress.current.cards[entry.id].grade === 'again')
          indexRef.current = firstUnreviewed >= 0 ? firstUnreviewed : 0
          setIndex(indexRef.current)
        }
      })
      .catch((cause) => {
        if (current) setError(cause instanceof Error ? cause.message : 'Flashcards could not be loaded.')
      })
    return () => {
      current = false
    }
  }, [reload, subject.releaseId])
  useEffect(() => {
    const controller: MaterialLearningController = {
      target: 'material-flashcards',
      executeVoiceAction: (action) => actionHandler.current(action as Extract<VoiceAction, { type: `flashcard.${string}` | `materialFlashcard.${string}` }>),
    }
    onLearningController(controller)
    return () => onLearningController(undefined)
  }, [onLearningController])
  const byId = useMemo(() => new Map(cards?.map((entry) => [entry.id, entry])), [cards]),
    card = byId.get(order[index])
  useEffect(() => {
    if (progressHydrated.current || !progress || !cards?.length) return
    progressHydrated.current = true
    const firstUnreviewed = cards.findIndex((entry) => !progress.cards[entry.id] || progress.cards[entry.id].grade === 'again')
    indexRef.current = firstUnreviewed >= 0 ? firstUnreviewed : 0
    setIndex(indexRef.current)
  }, [cards, progress])
  function reveal(value: boolean) {
    revealedRef.current = value
    setRevealed(value)
  }
  function markGraded(value: boolean) {
    gradedRef.current = value
    setGraded(value)
  }
  function currentCard() {
    return cardsRef.current.find((entry) => entry.id === orderRef.current[indexRef.current])
  }
  function navigate(next: number) {
    indexRef.current = Math.max(0, Math.min(orderRef.current.length - 1, next))
    setIndex(indexRef.current)
    reveal(false)
    markGraded(false)
  }
  function shuffle() {
    const active = currentCard()
    if (!active) return
    const next = shuffledIds(orderRef.current)
    orderRef.current = next
    indexRef.current = Math.max(0, next.indexOf(active.id))
    setOrder(next)
    setIndex(indexRef.current)
    reveal(false)
    markGraded(false)
  }
  function gradeCurrent(grade: FlashcardGrade) {
    const active = currentCard()
    if (!active || gradedRef.current || !revealedRef.current) return false
    onGrade(active.id, grade)
    const transition = flashcardGradeTransition(grade, indexRef.current, orderRef.current.length)
    if (transition === 'repeat') {
      reveal(false)
      markGraded(false)
    } else if (transition === 'next') navigate(indexRef.current + 1)
    else markGraded(true)
    return true
  }
  async function requestHint() {
    const active = currentCard()
    if (!active || hintsRef.current[active.id] || loadingHintRef.current) return Boolean(active && hintsRef.current[active.id])
    if (!signedIn) {
      onSignIn()
      return false
    }
    loadingHintRef.current = active.id
    setLoadingHintId(active.id)
    setAiError(undefined)
    try {
      const result = await generateMaterialFlashcardHint(subject, active)
      onBalance(result.balance)
      hintsRef.current = { ...hintsRef.current, [active.id]: result.hint }
      setHints(hintsRef.current)
      return true
    } catch (cause) {
      if (cause instanceof AIActionError && cause.balance) onBalance(cause.balance)
      if (cause instanceof AIActionError && cause.code === 'insufficient_credits') onInsufficientCredits('A flashcard hint', 1)
      else setAiError(cause instanceof Error ? cause.message : 'The hint could not be generated. No credit was charged.')
      return false
    } finally {
      loadingHintRef.current = undefined
      setLoadingHintId(undefined)
    }
  }
  useEffect(() => {
    actionHandler.current = async (action) => {
      const active = currentCard()
      if (!active) return { ok: false, error: 'The flashcard is still loading.' }
      if (action.type === 'flashcard.side') {
        reveal(action.side === 'answer')
        return {
          ok: true,
          message: `${action.side === 'answer' ? 'Answer' : 'Question'} shown.`,
        }
      }
      if (action.type === 'flashcard.navigate') {
        const next = indexRef.current + (action.direction === 'next' ? 1 : -1)
        if (next < 0 || next >= orderRef.current.length) return { ok: false, error: `There is no ${action.direction} card.` }
        navigate(next)
        return { ok: true, message: `Moved to card ${next + 1}.` }
      }
      if (action.type === 'flashcard.shuffle') {
        shuffle()
        return { ok: true, message: 'Deck shuffled.' }
      }
      if (action.type === 'materialFlashcard.hint') {
        if (hintsRef.current[active.id]) return { ok: true, message: 'The hint is already visible.' }
        return (await requestHint())
          ? {
              ok: true,
              message: 'The hint is now visible on the question side.',
            }
          : { ok: false, error: 'The hint was not generated.' }
      }
      if (!revealedRef.current)
        return {
          ok: false,
          error: 'Reveal the answer before grading this card.',
        }
      return gradeCurrent(action.grade) ? { ok: true, message: `Card graded ${action.grade}.` } : { ok: false, error: 'This card has already been graded.' }
    }
  })
  useEffect(() => {
    if (!card) return
    const state: MaterialFlashcardVoiceState = {
      target: 'material-flashcards',
      subject: subject.title,
      deckId: `materials:${subject.releaseId}`,
      cardId: card.id,
      index,
      count: order.length,
      side: revealed ? 'answer' : 'question',
      graded,
      question: {
        heading: card.section || 'Question',
        body: materialFlashcardFace(card, false),
      },
      answer: revealed ? { heading: 'Answer', body: materialFlashcardFace(card, true) } : undefined,
      hint: hints[card.id],
    }
    onLearningState(state)
  }, [card, graded, hints, index, onLearningState, order.length, revealed, subject.releaseId, subject.title])
  useEffect(() => () => onLearningState(undefined), [onLearningState])
  useEffect(() => {
    if (!card) return
    const stage = document.querySelector<HTMLElement>('.subject-materials-flashcards .material-card-stage')
    if (!stage) return
    stage.tabIndex = 0
    stage.setAttribute('role', 'button')
    stage.setAttribute('aria-label', `${revealed ? 'Answer' : 'Question'} side. Activate to ${revealed ? 'show the question' : 'reveal the answer'}.`)
    const flip = (event: Event) => {
      if (!(event.target as Element).closest('a, button, input, select, textarea')) reveal(!revealedRef.current)
    }
    const flipKey = (event: globalThis.KeyboardEvent) => {
      if (event.target !== stage || (event.key !== 'Enter' && event.key !== ' ')) return
      event.preventDefault()
      reveal(!revealedRef.current)
    }
    stage.addEventListener('click', flip)
    stage.addEventListener('keydown', flipKey)
    return () => {
      stage.removeEventListener('click', flip)
      stage.removeEventListener('keydown', flipKey)
    }
  }, [card, revealed])
  if (error)
    return (
      <Failure
        message={error}
        retry={() => {
          setError(undefined)
          setReload((value) => value + 1)
        }}
      />
    )
  if (!cards) return <Loading />
  if (!card) return <div className="materials-state">No flashcards are available for this subject yet.</div>
  const reviewed = cards.filter((entry) => progress?.cards[entry.id]?.grade !== undefined && progress.cards[entry.id].grade !== 'again').length
  return (
    <div className="material-card-study">
      <header>
        <div>
          <strong>
            {reviewed}/{cards.length} reviewed
          </strong>
          <Progress value={(reviewed / cards.length) * 100} />
        </div>
        <div>
          <Button variant="ghost" onClick={() => void requestHint()} disabled={Boolean(hints[card.id]) || Boolean(loadingHintId)}>
            <Lightbulb />
            {hints[card.id] ? 'Hint unlocked' : loadingHintId === card.id ? 'Generating...' : signedIn ? 'Hint · 1 credit' : 'Sign in for hint'}
          </Button>
          <Button variant="ghost" onClick={shuffle}>
            <Shuffle />
            Shuffle
          </Button>
        </div>
      </header>
      {aiError && (
        <div className="ai-action-error" role="alert">
          <span>{aiError}</span>
        </div>
      )}
      <div className="material-card-nav">
        <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => navigate(index - 1)}>
          <ArrowLeft />
          Previous
        </Button>
        <span>
          Card {index + 1} of {cards.length}
        </span>
        <Button variant="ghost" size="sm" disabled={index === cards.length - 1} onClick={() => navigate(index + 1)}>
          Next
          <ArrowRight />
        </Button>
      </div>
      <Card className={`material-card-stage ${revealed ? 'flipped' : ''}`}>
        <div className="material-card-inner">
          <div className="material-card-face material-card-front" aria-hidden={revealed} inert={revealed ? true : undefined}>
            <span>Question</span>
            <MaterialMarkdown markdown={materialFlashcardFace(card, false)} mnemonics={new Map()} />
            {hints[card.id] && (
              <div className="assessment-hint">
                <Lightbulb />
                <div>
                  <strong>Hint</strong>
                  <p>{hints[card.id]}</p>
                </div>
              </div>
            )}
            <small>
              <ScanLine />
              Tap the card to flip and reveal the answer.
            </small>
          </div>
          <div className="material-card-face material-card-back" aria-hidden={!revealed} inert={!revealed ? true : undefined}>
            <span>Answer</span>
            <MaterialMarkdown markdown={materialFlashcardFace(card, true)} mnemonics={new Map()} />
            <small>Grade your recall below, then move to the next card.</small>
          </div>
        </div>
      </Card>
      <div className="material-card-actions">
        {revealed && (
          <div aria-label="Grade this card">
            {(['again', 'hard', 'good', 'easy'] as const).map((grade) => (
              <Button key={grade} variant="grade" disabled={graded} onClick={() => gradeCurrent(grade)}>
                {grade[0].toUpperCase() + grade.slice(1)}
              </Button>
            ))}
          </div>
        )}
        <Button size="lg" onClick={() => reveal(!revealedRef.current)} aria-expanded={revealed}>
          {revealed ? (
            <>
              <RotateCcw />
              Show question
            </>
          ) : (
            <>
              <Eye />
              Reveal answer
            </>
          )}
        </Button>
      </div>
      <div className="mobile-material-card-controls"><Button variant="outline" onClick={() => void requestHint()} disabled={Boolean(hints[card.id]) || Boolean(loadingHintId)}><Lightbulb />{hints[card.id] ? 'Hint' : signedIn ? 'Hint · 1' : 'Sign in'}</Button><Button variant="outline" onClick={shuffle}><Shuffle />Shuffle</Button></div>
    </div>
  )
}

function MaterialPractice({ subject, progress, onProgress, signedIn, onBalance, onInsufficientCredits, onSignIn, onLearningState, onLearningController, onBack }: LearningProps & { subject: MaterialSubject; progress?: MaterialReleaseProgress; onProgress: Props['onProgress']; onBack: () => void }) {
  const initialProgress = useRef(progress)
  const progressHydrated = useRef(Boolean(progress))
  const [questions, setQuestions] = useState<MaterialQuestion[]>(),
    [index, setIndex] = useState(0),
    [answers, setAnswers] = useState<Record<string, number>>(() => progress?.practiceAnswers ?? {}),
    [submitted, setSubmitted] = useState(() => progress?.practiceSubmitted ?? false)
  const [hints, setHints] = useState<Record<string, string>>({}),
    [corrections, setCorrections] = useState<string[]>(),
    [loadingHintId, setLoadingHintId] = useState<string>(),
    [loadingCorrections, setLoadingCorrections] = useState(false),
    [grading, setGrading] = useState(false)
  const [aiError, setAiError] = useState<string>(),
    [error, setError] = useState<string>(),
    [reload, setReload] = useState(0)
  const [navOpen, setNavOpen] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const actionHandler = useRef<(action: Extract<VoiceAction, { type: `assessment.${string}` }>) => Promise<VoiceActionResult>>(async () => ({ ok: false, error: 'The practice test is still loading.' }))
  useEffect(() => {
    let current = true
    void (async () => {
      try {
        const rows = await listMaterialQuestions(subject.releaseId)
        if (!current) return
        if (rows.length < 20) setError('This practice test does not contain the required 20 questions.')
        else {
          let next = rows.slice(0, 20)
          if (initialProgress.current?.practiceSubmitted) {
            const grade = await submitMaterialQuestions(subject.releaseId, initialProgress.current.practiceAnswers)
            const results = new Map(grade.results.map((result) => [result.id, result]))
            next = next.map((entry) => ({ ...entry, ...results.get(entry.id) }))
          }
          if (!current) return
          setQuestions(next)
          const firstUnanswered = next.findIndex((entry) => initialProgress.current?.practiceAnswers[entry.id] === undefined)
          setIndex(firstUnanswered >= 0 ? firstUnanswered : 0)
        }
      } catch (cause) {
        if (current) setError(cause instanceof Error ? cause.message : 'Practice questions could not be loaded.')
      }
    })()
    return () => {
      current = false
    }
  }, [reload, subject.releaseId])
  useEffect(() => {
    const controller: MaterialLearningController = {
      target: 'material-practice',
      executeVoiceAction: (action) => actionHandler.current(action as Extract<VoiceAction, { type: `assessment.${string}` }>),
    }
    onLearningController(controller)
    return () => onLearningController(undefined)
  }, [onLearningController])
  const question = questions?.[index],
    answered = Object.keys(answers).length
  useEffect(() => {
    if (progressHydrated.current || !progress || !questions?.length || answered > 0) return
    progressHydrated.current = true
    let current = true
    void (async () => {
      try {
        let next = questions
        if (progress.practiceSubmitted) {
          setGrading(true)
          const grade = await submitMaterialQuestions(subject.releaseId, progress.practiceAnswers)
          const results = new Map(grade.results.map((result) => [result.id, result]))
          next = questions.map((entry) => ({ ...entry, ...results.get(entry.id) }))
        }
        if (!current) return
        setQuestions(next)
        setAnswers(progress.practiceAnswers)
        setSubmitted(progress.practiceSubmitted)
        const firstUnanswered = next.findIndex((entry) => progress.practiceAnswers[entry.id] === undefined)
        setIndex(firstUnanswered >= 0 ? firstUnanswered : 0)
      } catch (cause) {
        if (current) setError(cause instanceof Error ? cause.message : 'The saved practice result could not be loaded.')
      } finally {
        if (current) setGrading(false)
      }
    })()
    return () => { current = false }
  }, [answered, progress, questions, subject.releaseId])
  async function requestHint() {
    if (!question || submitted || hints[question.id] || loadingHintId) return Boolean(question && hints[question.id])
    if (!signedIn) {
      onSignIn()
      return false
    }
    setLoadingHintId(question.id)
    setAiError(undefined)
    try {
      const result = await generateMaterialQuestionHint(subject, question)
      onBalance(result.balance)
      setHints((current) => ({ ...current, [question.id]: result.hint }))
      return true
    } catch (cause) {
      if (cause instanceof AIActionError && cause.balance) onBalance(cause.balance)
      if (cause instanceof AIActionError && cause.code === 'insufficient_credits') onInsufficientCredits('A material assessment hint', 1)
      else setAiError(cause instanceof Error ? cause.message : 'The hint could not be generated. No credit was charged.')
      return false
    } finally {
      setLoadingHintId(undefined)
    }
  }
  async function submit() {
    if (!questions || answered !== questions.length || submitted) return false
    setGrading(true)
    setAiError(undefined)
    try {
      const grade = await submitMaterialQuestions(subject.releaseId, answers)
      const results = new Map(grade.results.map((result) => [result.id, result]))
      setQuestions(questions.map((entry) => ({ ...entry, ...results.get(entry.id) })))
      setReviewing(false)
      setSubmitted(true)
      onProgress(subject, { practiceAnswers: answers, practiceSubmitted: true })
      return true
    } catch (cause) {
      setAiError(cause instanceof Error ? cause.message : 'The practice test could not be graded.')
      return false
    } finally {
      setGrading(false)
    }
  }
  async function requestCorrections() {
    if (!questions || !submitted || loadingCorrections) return 'failure' as const
    if (corrections) return 'success' as const
    if (!signedIn) {
      onSignIn()
      return 'failure' as const
    }
    setLoadingCorrections(true)
    setAiError(undefined)
    try {
      const result = await generateMaterialCorrections(
        subject,
        questions,
        questions.map((entry) => answers[entry.id] ?? null),
      )
      onBalance(result.balance)
      setCorrections(result.corrections)
      setIndex(0)
      setReviewing(true)
      return 'success' as const
    } catch (cause) {
      if (cause instanceof AIActionError && cause.balance) onBalance(cause.balance)
      if (cause instanceof AIActionError && cause.code === 'insufficient_credits') onInsufficientCredits('Material assessment corrections', 2)
      else setAiError(cause instanceof Error ? cause.message : 'Corrections could not be generated. No credit was charged.')
      return 'failure' as const
    } finally {
      setLoadingCorrections(false)
    }
  }
  useEffect(() => {
    actionHandler.current = async (action) => {
      if (!questions || !question) return { ok: false, error: 'The practice test is still loading.' }
      if (action.type === 'assessment.select') {
        if (submitted)
          return {
            ok: false,
            error: 'This assessment has already been submitted.',
          }
        if (action.optionIndex < 0 || action.optionIndex >= question.options.length) return { ok: false, error: 'That option is not available.' }
        setAnswers((current) => {
          const next = { ...current, [question.id]: action.optionIndex }
          onProgress(subject, { practiceAnswers: next })
          return next
        })
        return {
          ok: true,
          message: `Option ${String.fromCharCode(65 + action.optionIndex)} selected for question ${index + 1}.`,
        }
      }
      if (action.type === 'assessment.navigate') {
        const next = index + (action.direction === 'next' ? 1 : -1)
        if (next < 0 || next >= questions.length)
          return {
            ok: false,
            error: `There is no ${action.direction} question.`,
          }
        setIndex(next)
        return { ok: true, message: `Moved to question ${next + 1}.` }
      }
      if (action.type === 'assessment.hint') {
        if (submitted)
          return {
            ok: false,
            error: 'Hints are unavailable after submission.',
          }
        if (hints[question.id]) return { ok: true, message: 'The hint is already visible.' }
        return (await requestHint()) ? { ok: true, message: 'The hint is now visible.' } : { ok: false, error: 'The hint was not generated or the charge was declined.' }
      }
      if (action.type === 'assessment.corrections') {
        if (!submitted) return { ok: false, error: 'Corrections are only available after submission.' }
        if (corrections) return { ok: true, message: 'Corrections are already visible.' }
        const result = await requestCorrections()
        return result === 'success' ? { ok: true, message: 'Corrections are now visible.' } : { ok: false, error: 'Corrections could not be generated.' }
      }
      if (action.type === 'assessment.review') {
        if (!submitted) return { ok: false, error: 'Submit the assessment before reviewing answers.' }
        if (!corrections) return { ok: false, error: 'Paid corrections must be unlocked before Nerd Bot can review material answers.' }
        setIndex(0)
        setReviewing(true)
        return { ok: true, message: 'Answer review opened.' }
      }
      if (submitted)
        return {
          ok: false,
          error: 'This assessment has already been submitted.',
        }
      if (answered !== questions.length) return { ok: false, error: 'Answer every question before submitting.' }
      if (!window.confirm('Submit this assessment for final grading?'))
        return {
          ok: false,
          error: 'The learner did not confirm assessment submission.',
        }
      return (await submit()) ? { ok: true, message: 'Assessment submitted.' } : { ok: false, error: 'The assessment could not be graded.' }
    }
  })
  useEffect(() => {
    if (!questions || !question) return
    onLearningState({
      target: 'material-practice',
      subject: subject.title,
      questionId: question.id,
      index,
      count: questions.length,
      question: question.question,
      options: [...question.options],
      selectedIndex: answers[question.id] ?? null,
      submitted,
      hint: hints[question.id],
      phase: !submitted ? 'taking' : reviewing ? 'review' : 'result',
      score: submitted ? questions.filter((entry) => answers[entry.id] === entry.answerIndex).length : undefined,
      correctAnswer: submitted && reviewing ? question.options[question.answerIndex] : undefined,
      explanation: submitted && reviewing ? corrections?.[index] ?? question.explanation : undefined,
    })
  }, [answers, corrections, hints, index, onLearningState, question, questions, reviewing, subject.title, submitted])
  useEffect(() => () => onLearningState(undefined), [onLearningState])
  if (error)
    return (
      <Failure
        message={error}
        retry={() => {
          setError(undefined)
          setReload((value) => value + 1)
        }}
      />
    )
  if (!questions || !question || grading && submitted) return <Loading />
  const selected = answers[question.id],
    score = submitted ? questions.filter((entry) => answers[entry.id] === entry.answerIndex).length : 0,
    percentage = Math.round((score / questions.length) * 100),
    correction = corrections?.[index],
    showingReview = submitted && reviewing
  return (
    <div className="material-practice assessment-view">
      {aiError && (
        <div className="ai-action-error" role="alert">
          <span>{aiError}</span>
        </div>
      )}
      {submitted && !corrections && !reviewing ? (
        <section className="assessment-result" aria-live="polite">
          <div className="assessment-score">
            <div className="assessment-score-ring" style={{ background: `conic-gradient(var(--success) ${percentage}%, var(--learn-muted) 0)` }}><span><strong>{percentage}%</strong><small>{score} / {questions.length}</small></span></div>
          </div>
          <div className="assessment-result-copy">
            <h2>{percentage >= 70 ? 'Strong result.' : 'Keep building.'}</h2>
            <p>You answered {score} of {questions.length} questions correctly.</p>
            <div>
              <Button variant="ai" onClick={() => void requestCorrections()} disabled={loadingCorrections}>
                <Zap />{loadingCorrections ? 'Preparing corrections...' : 'Unlock corrections · 2 credits'}
              </Button>
              <Button variant="outline" onClick={() => { setIndex(0); setReviewing(true) }}>Review answers</Button>
              <Button className="assessment-back-button" onClick={onBack}>Back to tests</Button>
            </div>
          </div>
        </section>
      ) : (
        <div className="assessment-workspace">
          {navOpen && <button className="assessment-nav-backdrop" onClick={() => setNavOpen(false)} aria-label="Close question navigator" />}
          <Card className={`assessment-navigator ${navOpen ? 'mobile-open' : ''}`}>
            <header>
              <div>
                <span>Progress</span>
                <strong>
                  {answered}/{questions.length}
                </strong>
                <b className="mobile-current-question">Q{index + 1} <em>/ {questions.length}</em></b>
              </div>
              <Button variant="outline" className="mobile-question-nav-trigger" onClick={() => setNavOpen(true)}><LayoutGrid />{answered}/{questions.length}</Button>
              <Progress value={(answered / questions.length) * 100} />
            </header>
            <div className="mobile-navigator-title"><i /><strong>Question navigator</strong><span>{answered} of {questions.length} answered</span></div>
            <div className="assessment-question-grid" aria-label="Assessment questions">
              {questions.map((entry, questionIndex) => (
                <button key={entry.id} className={`${questionIndex === index ? 'active' : ''} ${answers[entry.id] !== undefined ? 'complete' : ''}`} onClick={() => { setIndex(questionIndex); setNavOpen(false) }} aria-label={`Question ${questionIndex + 1}${answers[entry.id] !== undefined ? ', answered' : ', unanswered'}`} aria-current={questionIndex === index ? 'step' : undefined}>
                  {questionIndex + 1}
                </button>
              ))}
            </div>
            <footer>
              <span>
                <i className="answered" />
                Answered
              </span>
              <span>
                <i className="current" />
                Current
              </span>
            </footer>
          </Card>
          <Card className="quiz-stage assessment-stage">
            <header>
              <div>
                <span className="question-number">{index + 1}</span>
                <strong>
                  Question {index + 1} of {questions.length}
                </strong>
              </div>
              <div>
                {!submitted && (
                  <Button variant="ghost" size="sm" className="hint-button" onClick={() => void requestHint()} disabled={Boolean(loadingHintId) || Boolean(hints[question.id])}>
                    <Lightbulb />
                    {hints[question.id] ? 'Hint unlocked' : loadingHintId === question.id ? 'Generating...' : signedIn ? 'Hint · 1 credit' : 'Sign in for hint'}
                  </Button>
                )}
              </div>
            </header>
            <div className="assessment-question-copy">
              <h2>{question.question}</h2>
            </div>
            <fieldset disabled={submitted}>
              {question.options.map((option, optionIndex) => {
                const correct = showingReview && optionIndex === question.answerIndex,
                  isSelected = selected === optionIndex
                return (
                  <label key={optionIndex} className={`${isSelected ? 'selected' : ''} ${showingReview ? `${correct ? 'correction-correct' : ''} ${isSelected && !correct ? 'correction-selected' : ''}` : ''}`}>
                    <input
                      type="radio"
                      name={`material-question-${question.id}`}
                      checked={isSelected}
                      onChange={() => setAnswers((current) => {
                        const next = { ...current, [question.id]: optionIndex }
                        onProgress(subject, { practiceAnswers: next })
                        return next
                      })}
                    />
                    <span>{String.fromCharCode(65 + optionIndex)}</span>
                    <b>{option}</b>
                    {correct && <Check />}
                  </label>
                )
              })}
            </fieldset>
            {hints[question.id] && (
              <div className="assessment-hint">
                <Lightbulb />
                <div>
                  <strong>Hint</strong>
                  <p>{hints[question.id]}</p>
                </div>
              </div>
            )}
            {showingReview && (
              <div className="assessment-correction">
                <span>{correction ? 'AI correction' : 'Explanation'}</span>
                <h3>{selected === question.answerIndex ? 'Your answer was correct.' : `Correct answer: ${question.options[question.answerIndex]}`}</h3>
                <p>{correction ?? question.explanation}</p>
                {correction && <small>{question.explanation}</small>}
              </div>
            )}
            <footer>
              {!submitted && <Button variant="ghost" className="mobile-assessment-hint" onClick={() => void requestHint()} disabled={Boolean(loadingHintId) || Boolean(hints[question.id])} aria-label="Request hint"><Lightbulb /></Button>}
              <Button variant="ghost" onClick={() => setIndex(index - 1)} disabled={index === 0}>
                <ArrowLeft />
                Previous
              </Button>
              <span>{answered} answered</span>
              <div>
                {index < questions.length - 1 && (
                  <Button onClick={() => setIndex(index + 1)}>
                    Next
                    <ArrowRight />
                  </Button>
                )}
                {!submitted && index === questions.length - 1 && (
                  <Button onClick={() => void submit()} disabled={answered !== questions.length || grading}>
                    {grading ? 'Grading...' : 'Submit test'}
                  </Button>
                )}
              </div>
            </footer>
          </Card>
        </div>
      )}
    </div>
  )
}

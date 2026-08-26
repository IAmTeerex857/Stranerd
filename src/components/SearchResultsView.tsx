import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, ClipboardList, Compass, GalleryVerticalEnd, Search } from 'lucide-react'
import { anatomyModels, modelCategoryForModel } from '../data/models'
import { listMaterialSubjects } from '../lib/materials'
import type { FlashcardDeckProgress, MaterialReleaseProgress } from '../types'
import type { MaterialSubject } from '../types/materials'
import { Progress } from '@/components/ui/progress'

type SearchCategory = 'all' | 'subjects' | 'flashcards' | 'practice' | 'notes'
type ResultKind = Exclude<SearchCategory, 'all'>
type SearchResult = { id: string; kind: ResultKind; title: string; subtitle: string; href: string; completed?: number; total?: number }

const materialAliases: Record<string, string> = {
  'cardiovascular-system': 'heart cardiac circulation',
  'nervous-system': 'brain neural neurology',
  'respiratory-system': 'lungs pulmonary',
  'urinary-renal-system': 'kidney renal urinary',
  'clinical-ophthalmology': 'eye vision ocular',
  'gastrointestinal-system': 'liver digestive digestion',
  'clinical-dermatology': 'skin integumentary',
  'musculoskeletal-system': 'human anatomy muscles skeleton',
}

function materialMatches(subject: MaterialSubject, query: string) {
  return `${subject.title} ${subject.slug.replaceAll('-', ' ')} ${materialAliases[subject.slug] ?? ''}`.toLowerCase().includes(query)
}

function materialResults(subject: MaterialSubject, materialProgressByRelease: Record<string, MaterialReleaseProgress>, progressByDeck: Record<string, FlashcardDeckProgress>): SearchResult[] {
  const materialProgress = materialProgressByRelease[subject.releaseId]?.contentVersion === subject.contentVersion ? materialProgressByRelease[subject.releaseId] : undefined
  const deckProgress = progressByDeck[`materials:${subject.releaseId}`]?.contentVersion === subject.contentVersion ? progressByDeck[`materials:${subject.releaseId}`] : undefined
  const reviewed = deckProgress ? Object.values(deckProgress.cards).filter((card) => card.grade !== 'again').length : 0
  const answered = materialProgress ? Object.keys(materialProgress.practiceAnswers).length : 0
  const practiceTotal = Math.min(20, subject.counts.questions)
  return [
    { id: `${subject.id}:notes`, kind: 'notes', title: `${subject.title} notes`, subtitle: `${subject.counts.sections} sections`, href: `/app?subject=${encodeURIComponent(subject.slug)}&content=notes`, completed: materialProgress?.readSectionIds.length ?? 0, total: subject.counts.sections },
    { id: `${subject.id}:flashcards`, kind: 'flashcards', title: `${subject.title} flashcards`, subtitle: `${subject.counts.flashcards} cards`, href: `/app?subject=${encodeURIComponent(subject.slug)}&content=flashcards`, completed: reviewed, total: subject.counts.flashcards },
    { id: `${subject.id}:practice`, kind: 'practice', title: `${subject.title} practice test`, subtitle: `${practiceTotal} questions`, href: `/app?subject=${encodeURIComponent(subject.slug)}&content=practice`, completed: answered, total: practiceTotal },
  ]
}

const categoryCopy: Record<ResultKind, { label: string; Icon: typeof Search }> = {
  subjects: { label: 'Subjects', Icon: Compass },
  flashcards: { label: 'Flashcards', Icon: GalleryVerticalEnd },
  practice: { label: 'Practice tests', Icon: ClipboardList },
  notes: { label: 'Notes', Icon: BookOpen },
}

export function SearchResultsView({ query, materialProgressByRelease, progressByDeck }: { query: string; materialProgressByRelease: Record<string, MaterialReleaseProgress>; progressByDeck: Record<string, FlashcardDeckProgress> }) {
  const [subjects, setSubjects] = useState<MaterialSubject[]>()
  const [error, setError] = useState<string>()
  const [category, setCategory] = useState<SearchCategory>('all')
  const normalized = query.trim().toLowerCase()

  useEffect(() => {
    let current = true
    void listMaterialSubjects().then((rows) => { if (current) setSubjects(rows) }).catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : 'Search results could not be loaded.') })
    return () => { current = false }
  }, [])

  const matchedModels = anatomyModels.filter((model) => `${model.name} ${model.scientificName} ${model.system} ${model.metadata.region} ${modelCategoryForModel(model.id).label}`.toLowerCase().includes(normalized))
  const matchedMaterials = (subjects ?? []).filter((subject) => materialMatches(subject, normalized))
  const subjectResults: SearchResult[] = [
    ...matchedModels.map((model) => ({ id: `model:${model.id}`, kind: 'subjects' as const, title: model.name, subtitle: `${modelCategoryForModel(model.id).label} · ${model.metadata.region}`, href: `/app?model=${encodeURIComponent(model.id)}` })),
    ...matchedMaterials.filter((subject) => !matchedModels.some((model) => materialAliases[subject.slug]?.includes(model.id))).map((subject) => ({ id: `subject:${subject.id}`, kind: 'subjects' as const, title: subject.title, subtitle: `${subject.counts.sections} note sections · ${subject.counts.flashcards} flashcards`, href: `/app?subject=${encodeURIComponent(subject.slug)}&content=notes` })),
  ]
  const resources = matchedMaterials.flatMap((subject) => materialResults(subject, materialProgressByRelease, progressByDeck))
  const results = [...subjectResults, ...resources]
  const groups = (Object.keys(categoryCopy) as ResultKind[]).map((kind) => ({ kind, results: results.filter((result) => result.kind === kind) }))
  const visibleGroups = category === 'all' ? groups : groups.filter((group) => group.kind === category)
  const topResult = subjectResults[0] ?? resources[0]

  return <section className="global-search-page" aria-labelledby="global-search-heading">
    <header><span>Global search</span><h1 id="global-search-heading">{results.length} {results.length === 1 ? 'result' : 'results'} for <strong>“{query}”</strong></h1></header>
    <div className="global-search-tabs" role="tablist" aria-label="Filter search results">{(['all', 'subjects', 'flashcards', 'practice', 'notes'] as SearchCategory[]).map((kind) => {
      const count = kind === 'all' ? results.length : results.filter((result) => result.kind === kind).length
      const label = kind === 'all' ? 'All' : categoryCopy[kind].label
      return <button key={kind} type="button" role="tab" aria-selected={category === kind} className={category === kind ? 'active' : ''} onClick={() => setCategory(kind)}>{label}<b>{count}</b></button>
    })}</div>
    {!subjects && !error && <div className="global-search-state">Searching published learning materials...</div>}
    {error && <div className="global-search-state error" role="alert">{error}</div>}
    {subjects && results.length === 0 && <div className="global-search-empty"><Search /><h2>No results found</h2><p>Try a subject, body system, note topic, or practice-test name.</p></div>}
    {subjects && results.length > 0 && <>
      {category === 'all' && topResult && <a className="global-search-top-result" href={topResult.href}><span>Top result</span><div><small>{topResult.kind === 'subjects' ? 'Subject' : categoryCopy[topResult.kind].label}</small><h2>{topResult.title}</h2></div><footer>{topResult.subtitle}<b>Open <ArrowRight /></b></footer></a>}
      <div className="global-search-groups">{visibleGroups.map(({ kind, results: groupResults }) => {
        const { label, Icon } = categoryCopy[kind]
        if (!groupResults.length) return category === 'all' ? null : <div className="global-search-empty compact" key={kind}><h2>No {label.toLowerCase()} found</h2></div>
        return <section className={`global-search-group search-${kind}`} key={kind} aria-labelledby={`search-${kind}`}><header><span><Icon /><h2 id={`search-${kind}`}>{label}</h2></span><i /><small>{groupResults.length} {groupResults.length === 1 ? 'result' : 'results'}</small></header><div>{groupResults.map((result) => {
          const complete = result.completed ?? 0
          const total = result.total ?? 0
          return <a href={result.href} key={result.id}><span className="global-result-icon"><Icon /></span><div><h3>{result.title}</h3><p>{result.subtitle}</p>{total > 0 && <div className="global-result-progress"><Progress value={(complete / total) * 100} /><small>{complete}/{total} {kind === 'practice' ? 'answered' : kind === 'flashcards' ? 'reviewed' : 'read'}</small></div>}</div><em>{label === 'Practice tests' ? 'Practice' : label}</em><ArrowRight /></a>
        })}</div></section>
      })}</div>
    </>}
  </section>
}

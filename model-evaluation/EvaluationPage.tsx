import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Box, Check, ChevronRight, ExternalLink, FileUp, FlaskConical, GitCompareArrows, Layers3, Moon, Search, ShieldCheck, Sparkles, Sun, X } from 'lucide-react'
import { models } from '../src/data/models'
import { useTheme } from '../src/theme-context'
import { sources, organGroups, type ModelSource } from './inventory'
import { ModelViewport, type ModelMetrics } from './ModelViewport'

const logo = '/branding/stranerd-wordmark.png'
const open3dSkeletonUrl = new URL('../assets/source-models/evaluation/derived/open3dmodel-skeleton.glb', import.meta.url).href
const open3dPelvisUrl = new URL('../assets/source-models/evaluation/derived/open3dmodel-pelvicfloor.glb', import.meta.url).href
const openAnatomyLiverUrl = new URL('../assets/source-models/evaluation/derived/openanatomy-liver-subset.glb', import.meta.url).href
const bodyPartsHeartUrl = new URL('../assets/source-models/evaluation/derived/bodyparts3d-heart.glb', import.meta.url).href
const zAnatomyLymphoidUrl = new URL('../assets/source-models/evaluation/derived/z-anatomy-lymphoid-organs.glb', import.meta.url).href

type Candidate = {
  id: string
  title: string
  subtitle: string
  url: string
  source: string
  organ: string
  scope: string
  attribution: string
  bytes?: number
  finding?: string
  recommendation?: string
  local?: boolean
}

type ScoreValue = 'pass' | 'review' | 'fail'
type Scorecards = Record<string, Record<string, ScoreValue>>
type EvaluationTab = 'specimen' | 'compare' | 'source' | 'recommendations' | 'scorecard'

const productionCandidates: Candidate[] = models.filter((model) => model.id !== 'anatomy').flatMap((model) => model.variants.slice(0, 2).map((variant) => ({
  id: `${model.id}:${variant.id}`, title: `${model.name} · ${variant.label}`, subtitle: variant.note ?? 'Current production specimen', url: `/models/${variant.file}`, source: 'stranerd', organ: model.name,
  scope: 'Current production baseline', attribution: 'Stranerd current asset inventory',
})))

const externalCandidates: Candidate[] = [
  {
    id: 'open3dmodel:skeleton', title: 'Complete skeleton', subtitle: 'Browser-ready named skeleton and cartilage structures',
    url: open3dSkeletonUrl, source: 'open3dmodel', organ: 'Skeleton', scope: 'Complete Open3DModel sample',
    attribution: 'Open3DModel - Skeleton - English labels; Open3D project, George J.R. Maat, LUMC, Eungyeol Lee, LUMC et al; CC BY-SA 4.0.',
    bytes: 6_552_784, finding: 'Strong named-mesh coverage and visual clarity, but the derivative is detailed at roughly 509k triangles.', recommendation: 'Shortlist for the skeletal atlas after mobile LOD work and ShareAlike review.',
  },
  {
    id: 'open3dmodel:pelvis', title: 'Pelvic floor and perineum', subtitle: 'Male pelvic anatomy with muscles, vessels, nerves and ligaments',
    url: open3dPelvisUrl, source: 'open3dmodel', organ: 'Male pelvis', scope: 'Complete Open3DModel sample',
    attribution: 'Open3DAnatomy Pelvic Floor and Perineum; Marco C. DeRuiter, Eungyeol Lee, Daniël Jansma et al; CC BY-SA 4.0.',
    bytes: 5_217_852, finding: 'Excellent layered regional detail across muscle, bone, vessels and nerves, with 119 selectable meshes.', recommendation: 'High-value pelvic module candidate after embedded texture rights and mobile performance are cleared.',
  },
  {
    id: 'openanatomy:liver', title: 'SPL liver atlas subset', subtitle: 'Three liver segments, portal/hepatic veins and gallbladder from CT',
    url: openAnatomyLiverUrl, source: 'openanatomy', organ: 'Liver', scope: '6 of 23 atlas structures',
    attribution: 'SPL Liver Atlas, Open Anatomy Project; Jakab, Pujol, Shaffer and Kikinis; 3D Slicer License Part B. Converted for evaluation.',
    bytes: 1_174_332, finding: 'The CT-derived segments and vessels align correctly and preserve authoritative label-map IDs, but this six-part sample is intentionally incomplete.', recommendation: 'Complete all 23 structures and use it for segmental liver and imaging-correlated lessons, not as a generic visual replacement.',
  },
  {
    id: 'bodyparts3d:heart', title: 'BodyParts3D heart', subtitle: 'FMA-backed heart assembly with chambers, valves and coronary structures',
    url: bodyPartsHeartUrl, source: 'bodyparts3d', organ: 'Heart', scope: '40 FMA concepts · 83 atomic meshes',
    attribution: 'BodyParts3D, © The Database Center for Life Science. Source release and current archive license notices retained.',
    bytes: 3_562_836, finding: 'The strongest tested semantic asset: detailed chambers, valves and coronary structures with FMA and BodyParts3D identities.', recommendation: 'Prioritize as the heart knowledge and structure backbone; improve materials and reconcile source-release licensing before production.',
  },
  {
    id: 'z-anatomy:lymphoid', title: 'Z-Anatomy lymphoid organs', subtitle: 'Whole-body lymph nodes, spleen, thymus and tonsils',
    url: zAnatomyLymphoidUrl, source: 'z-anatomy', organ: 'Lymphoid organs', scope: '164 anatomical meshes after removing 59 helper meshes',
    attribution: 'BodyParts3D and Z-Anatomy contributors; CC BY-SA 4.0. Converted from LymphoidOrgans100.fbx for evaluation.',
    bytes: 9_203_708, finding: 'Unique whole-body lymphatic coverage at a reasonable triangle count, but many structures are tiny and source grouping helpers required cleanup.', recommendation: 'Keep as a specialist lymphatic candidate; optimize file size and audit every upstream structure before promotion.',
  },
]

const candidates = [...externalCandidates, ...productionCandidates]
const requestedCandidate = candidates.find((entry) => entry.id === new URLSearchParams(window.location.search).get('candidate')) ?? externalCandidates[0]
const requestedTabValue = new URLSearchParams(window.location.search).get('tab')
const requestedTab: EvaluationTab = ['compare', 'source', 'recommendations', 'scorecard'].includes(requestedTabValue ?? '') ? requestedTabValue as EvaluationTab : 'specimen'
const readiness = [
  ['Geometry', 'Structure boundaries and silhouettes'], ['Interaction', 'Selection, visibility, fade and isolation'],
  ['Semantics', 'Stable IDs, names and hierarchy'], ['Performance', 'Transfer, parse and rendering budgets'],
  ['Rights', 'Commercial use, attribution and provenance'], ['Accuracy', 'Expert review and source evidence'],
]

function SourceCard({ source, selected, sampleCount, onSelect }: { source: ModelSource; selected: boolean; sampleCount: number; onSelect: () => void }) {
  return <button className={`eval-source-card ${selected ? 'active' : ''}`} onClick={onSelect}>
    <span className={`eval-status ${sampleCount ? 'ready' : source.status}`} />
    <div><strong>{source.name}</strong><small>{sampleCount ? `${sampleCount} visual ${sampleCount === 1 ? 'sample' : 'samples'}` : source.role}</small></div>
    <ChevronRight />
  </button>
}

export function EvaluationPage() {
  const { resolvedTheme, setPreference } = useTheme()
  const [sourceId, setSourceId] = useState(requestedCandidate.source)
  const [coverage, setCoverage] = useState('All coverage')
  const [query, setQuery] = useState('')
  const [candidate, setCandidate] = useState<Candidate>(requestedCandidate)
  const [compareCandidate, setCompareCandidate] = useState<Candidate>(productionCandidates.find((entry) => entry.id === 'heart:interactive') ?? productionCandidates[0])
  const [localCandidate, setLocalCandidate] = useState<Candidate>()
  const [metrics, setMetrics] = useState<ModelMetrics>()
  const [compareMetrics, setCompareMetrics] = useState<ModelMetrics>()
  const [selectedStructure, setSelectedStructure] = useState<string>()
  const [inspectorTab, setInspectorTab] = useState<'candidates' | 'structures'>('candidates')
  const [activeTab, setActiveTab] = useState<EvaluationTab>(requestedTab)
  const [scorecards, setScorecards] = useState<Scorecards>(() => { try { return JSON.parse(localStorage.getItem('stranerd.model-evaluation.scores.v1') ?? '{}') as Scorecards } catch { return {} } })
  const input = useRef<HTMLInputElement>(null)
  const selectedSource = sources.find((source) => source.id === sourceId) ?? sources[0]
  const sourceSamples = candidates.filter((entry) => entry.source === sourceId)
  const filteredSources = useMemo(() => sources.filter((source) => (coverage === 'All coverage' || source.coverage.includes(coverage)) && `${source.name} ${source.role} ${source.coverage.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [coverage, query])
  const filteredCandidates = candidates.filter((entry) => (coverage === 'All coverage' || entry.organ === coverage || entry.title.includes(coverage)) && (!query || `${entry.title} ${entry.subtitle} ${entry.organ}`.toLowerCase().includes(query.toLowerCase())))
  const displayedCandidate = localCandidate ?? candidate
  const currentScorecard = scorecards[displayedCandidate.id] ?? {}
  const scoreSummary = Object.values(currentScorecard)
  const structureRows = metrics?.structures.filter((structure) => !query || `${structure.name} ${structure.parent ?? ''}`.toLowerCase().includes(query.toLowerCase())) ?? []

  useEffect(() => () => { if (localCandidate?.local) URL.revokeObjectURL(localCandidate.url) }, [localCandidate])
  useEffect(() => { localStorage.setItem('stranerd.model-evaluation.scores.v1', JSON.stringify(scorecards)) }, [scorecards])

  function selectCandidate(next: Candidate) {
    setLocalCandidate(undefined)
    setCandidate(next)
    setSourceId(next.source)
    setMetrics(undefined)
    setSelectedStructure(undefined)
    const url = new URL(window.location.href)
    url.searchParams.set('candidate', next.id)
    window.history.replaceState({}, '', url)
    setActiveTab('specimen')
  }

  function loadLocal(file?: File) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.glb')) { window.alert('Choose a self-contained .glb file.'); return }
    const next = { id: `local:${file.name}:${file.lastModified}`, title: file.name, subtitle: `${(file.size / 1_048_576).toFixed(2)} MB local GLB`, url: URL.createObjectURL(file), source: 'local', organ: 'Local sample', scope: 'Browser-local file', attribution: 'Not recorded yet', local: true }
    setLocalCandidate(next)
    setMetrics(undefined)
    setSelectedStructure(undefined)
    setActiveTab('specimen')
  }

  function clearLocal() { setLocalCandidate(undefined); setMetrics(undefined); setSelectedStructure(undefined) }

  function cycleScore(category: string) {
    setScorecards((current) => {
      const scorecard = current[displayedCandidate.id] ?? {}
      const value = scorecard[category]
      const next: ScoreValue = value === 'pass' ? 'review' : value === 'review' ? 'fail' : 'pass'
      return { ...current, [displayedCandidate.id]: { ...scorecard, [category]: next } }
    })
  }

  return <main className="evaluation-shell app-shell">
    <header className="eval-topbar">
      <div className="eval-brand"><img src={logo} alt="Stranerd" /><i /><span>Model Evaluation Lab</span></div>
      <div className="eval-local-badge"><ShieldCheck />Local-only workspace</div>
      <div className="eval-top-actions"><a href="/app" target="_blank">Open production <ExternalLink /></a><button onClick={() => setPreference(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">{resolvedTheme === 'dark' ? <Sun /> : <Moon />}</button></div>
    </header>
    <aside className="eval-sidebar">
      <div className="eval-sidebar-heading"><span>Source inventory</span><b>{sources.length}</b></div>
      <label className="eval-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sources or structures" /></label>
      <label className="eval-filter"><span>Coverage</span><select value={coverage} onChange={(event) => setCoverage(event.target.value)}>{organGroups.map((item) => <option key={item}>{item}</option>)}</select></label>
      <div className="eval-sources">{filteredSources.map((source) => <SourceCard key={source.id} source={source} selected={sourceId === source.id} sampleCount={candidates.filter((entry) => entry.source === source.id).length} onSelect={() => { setSourceId(source.id); setActiveTab('source') }} />)}</div>
      <div className="eval-legend"><span><i className="ready" />Visual sample ready</span><span><i className="sample-needed" />Sample needed</span><span><i className="metadata-only" />Metadata/content</span></div>
    </aside>
    <section className="eval-workspace">
      <header className="eval-hero"><div><span>Asset qualification workspace</span><h1>See what is worth shipping.</h1><p>Compare real geometry, structure semantics, performance and source rights before an anatomy asset enters Stranerd.</p></div><button className="eval-upload" onClick={() => input.current?.click()}><FileUp />Load local GLB<input ref={input} hidden type="file" accept=".glb,model/gltf-binary" onChange={(event) => loadLocal(event.target.files?.[0])} /></button></header>
      {localCandidate && <div className="eval-local-file"><FileUp /><span><b>{localCandidate.title}</b><small>{localCandidate.subtitle} · stays in this browser tab</small></span><button onClick={clearLocal} aria-label="Remove local model"><X /></button></div>}
      <div className="eval-tabs"><button className={activeTab === 'specimen' ? 'active' : ''} onClick={() => setActiveTab('specimen')}><Box />Specimen</button><button className={activeTab === 'compare' ? 'active' : ''} onClick={() => setActiveTab('compare')}><GitCompareArrows />Compare</button><button className={activeTab === 'source' ? 'active' : ''} onClick={() => setActiveTab('source')}><Layers3 />Source</button><button className={activeTab === 'recommendations' ? 'active' : ''} onClick={() => setActiveTab('recommendations')}><Sparkles />Recommendations</button><button className={activeTab === 'scorecard' ? 'active' : ''} onClick={() => setActiveTab('scorecard')}><Activity />Scorecard</button></div>
      {activeTab === 'specimen' && <div className="eval-specimen-grid">
        <ModelViewport key={displayedCandidate.id} url={displayedCandidate.url} title={displayedCandidate.title} onMetrics={setMetrics} selectedStructure={selectedStructure} onSelectedStructure={setSelectedStructure} />
        <aside className="eval-inspector"><header><button className={inspectorTab === 'candidates' ? 'active' : ''} onClick={() => setInspectorTab('candidates')}>Candidates</button><button className={inspectorTab === 'structures' ? 'active' : ''} onClick={() => setInspectorTab('structures')}>Structures</button><b>{inspectorTab === 'candidates' ? filteredCandidates.length : structureRows.length}</b></header>{inspectorTab === 'candidates' ? <div className="eval-candidates">{filteredCandidates.map((entry) => <button key={entry.id} className={!localCandidate && candidate.id === entry.id ? 'active' : ''} onClick={() => selectCandidate(entry)}><i className={`source-${entry.source}`} /><span><strong>{entry.title}</strong><small>{entry.source} · {entry.scope}</small></span></button>)}</div> : <div className="eval-structures">{structureRows.map((structure) => <button key={structure.id} className={selectedStructure === structure.id ? 'active' : ''} onClick={() => setSelectedStructure(structure.id)}><span><strong>{structure.name}</strong><small>{structure.parent || 'Root structure'}</small></span><b>{structure.triangles.toLocaleString()}</b></button>)}</div>}<div className="eval-metrics"><span>Live geometry</span><dl><div><dt>Meshes</dt><dd>{metrics?.meshes ?? '—'}</dd></div><div><dt>Load</dt><dd>{metrics ? `${metrics.loadMs} ms` : '—'}</dd></div><div><dt>Triangles</dt><dd>{metrics?.triangles.toLocaleString() ?? '—'}</dd></div><div><dt>Materials</dt><dd>{metrics?.materials ?? '—'}</dd></div></dl></div></aside>
        <div className="eval-provenance"><span><b>{displayedCandidate.scope}{displayedCandidate.bytes ? ` · ${(displayedCandidate.bytes / 1_048_576).toFixed(2)} MB` : ''}</b><small>{displayedCandidate.attribution}</small></span>{displayedCandidate.finding && <span><b>Preliminary finding</b><small>{displayedCandidate.finding}</small></span>}{displayedCandidate.recommendation && <span><b>Recommendation</b><small>{displayedCandidate.recommendation}</small></span>}</div>
      </div>}
      {activeTab === 'compare' && <section className="eval-comparison"><header><div><label>Left specimen<select value={candidate.id} onChange={(event) => setCandidate(candidates.find((entry) => entry.id === event.target.value) ?? candidate)}>{candidates.map((entry) => <option value={entry.id} key={entry.id}>{entry.title}</option>)}</select></label><small>{metrics ? `${metrics.meshes} meshes · ${metrics.triangles.toLocaleString()} tris · ${metrics.loadMs} ms` : 'Loading metrics'}</small></div><GitCompareArrows /><div><label>Right specimen<select value={compareCandidate.id} onChange={(event) => setCompareCandidate(candidates.find((entry) => entry.id === event.target.value) ?? compareCandidate)}>{candidates.map((entry) => <option value={entry.id} key={entry.id}>{entry.title}</option>)}</select></label><small>{compareMetrics ? `${compareMetrics.meshes} meshes · ${compareMetrics.triangles.toLocaleString()} tris · ${compareMetrics.loadMs} ms` : 'Loading metrics'}</small></div></header><div><ModelViewport key={`left:${candidate.id}`} url={candidate.url} title={candidate.title} onMetrics={setMetrics} /><ModelViewport key={`right:${compareCandidate.id}`} url={compareCandidate.url} title={compareCandidate.title} onMetrics={setCompareMetrics} /></div></section>}
      {activeTab === 'source' && <article className="eval-source-detail">
        <header><span className={`eval-status ${sourceSamples.length ? 'ready' : selectedSource.status}`} /><div><span>{selectedSource.role}</span><h2>{selectedSource.name}</h2></div><a href={selectedSource.url} target="_blank" rel="noreferrer">Official source <ExternalLink /></a></header>
        {sourceSamples.length > 0 && <div className="eval-source-samples"><span>Available visual samples</span>{sourceSamples.map((sample) => <button key={sample.id} onClick={() => selectCandidate(sample)}><Box /><span><b>{sample.title}</b><small>{sample.scope}</small></span><ChevronRight /></button>)}</div>}
        <div className="eval-source-facts"><section><span>Coverage</span><div className="eval-chips">{selectedSource.coverage.map((item) => <b key={item}>{item}</b>)}</div></section><section><span>Formats</span><p>{selectedSource.formats}</p></section><section><span>Structure separation</span><p>{selectedSource.structure}</p></section><section><span>Metadata</span><p>{selectedSource.metadata}</p></section><section><span>Visual quality</span><p>{selectedSource.quality}</p></section><section><span>Attribution</span><p>{selectedSource.attribution}</p></section></div>
        <footer><span>Qualification risks</span>{selectedSource.risks.map((risk) => <p key={risk}><i />{risk}</p>)}</footer>
      </article>}
      {activeTab === 'recommendations' && <section className="eval-recommendations"><header><span>Source strategy</span><h2>Use the strongest source for each job.</h2><p>No single library gives us the best geometry, semantics, evidence and licensing at once.</p></header><div>{sources.map((source) => <article key={source.id} className={`verdict-${source.recommendation.verdict.replace(' ', '-')}`}><header><span className={`eval-status ${candidates.some((entry) => entry.source === source.id) ? 'ready' : source.status}`} /><h3>{source.name}</h3><b>{source.recommendation.verdict}</b></header><p>{source.recommendation.bestFor}</p><small>{source.recommendation.nextStep}</small></article>)}</div><footer><strong>Recommended architecture</strong><p><b>BodyParts3D</b> for canonical FMA identity, <b>OpenAnatomy</b> for imaging evidence, <b>Open3DModel</b> for efficient regional assets, <b>AlensiaXR</b> for premium visuals if partner terms work, <b>AnatomyZone</b> for instruction, and <b>Wolfram</b> for deterministic correctness.</p></footer></section>}
      {activeTab === 'scorecard' && <section className="eval-scorecard"><header><div><span>Promotion gate · {displayedCandidate.title}</span><h2>Production-readiness scorecard</h2></div><p>{scoreSummary.length ? `${scoreSummary.filter((value) => value === 'pass').length} passed · ${scoreSummary.filter((value) => value === 'review').length} need review · ${scoreSummary.filter((value) => value === 'fail').length} failed` : 'Score each sample after visual and functional inspection. Nothing is promoted automatically.'}</p></header><div>{readiness.map(([title, description]) => { const value = currentScorecard[title]; return <article key={title}><span><FlaskConical /></span><div><h3>{title}</h3><p>{description}</p></div><button className={value ? `score-${value}` : ''} onClick={() => cycleScore(title)}>{value === 'pass' ? <Check /> : value === 'fail' ? <X /> : <Activity />}{value ?? 'Not assessed'}</button></article> })}</div></section>}
    </section>
  </main>
}

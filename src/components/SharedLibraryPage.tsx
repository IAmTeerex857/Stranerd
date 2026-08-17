import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, ClipboardCheck, Layers3, LoaderCircle, Share2 } from 'lucide-react'
import { useAuth } from '../auth-context'
import { getLibraryShareMetadata, getSharedLibrarySet, gradeSharedLibrarySet, type LibraryShareMetadata } from '../lib/library'
import { LibraryStudyExperience } from './LibraryStudio'
import '../library-redesign.css'

export function SharedLibraryPage() {
  const { user, loading: authLoading } = useAuth()
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const [metadata, setMetadata] = useState<LibraryShareMetadata | null>(null)
  const [study, setStudy] = useState<Awaited<ReturnType<typeof getSharedLibrarySet>> | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState(token ? '' : 'This share link is missing its token.')

  useEffect(() => {
    let active = true
    if (!token) return
    void getLibraryShareMetadata(token).then((result) => { if (active) setMetadata(result) }).catch((requestError: unknown) => { if (active) setError(requestError instanceof Error ? requestError.message : 'This share link is unavailable.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  async function openStudy() {
    if (!user) {
      const next = window.location.pathname + window.location.search
      window.location.assign(`/login?next=${encodeURIComponent(next)}`)
      return
    }
    setOpening(true); setError('')
    try { setStudy(await getSharedLibrarySet(token)) }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'The shared set could not be opened.') }
    finally { setOpening(false) }
  }

  if (study) return <main className="library-redesign lr-shared-shell"><LibraryStudyExperience set={{ title: study.title, outputType: study.outputType, items: study.items }} readOnly onGrade={(answers) => gradeSharedLibrarySet(token, answers)} onBack={() => setStudy(null)} /></main>
  return <main className="library-redesign lr-shared-shell"><div className="lr-shared-page">
    <header className="lr-shared-brand"><span><SparkLogo /></span><strong>Stranerd Library</strong></header>
    {loading || authLoading ? <div className="lr-state"><LoaderCircle className="spin" /><h2>Opening shared set</h2></div> : error && !metadata ? <div className="lr-state"><AlertTriangle /><h2>Share unavailable</h2><p>{error}</p></div> : metadata && <article className="lr-shared-card">
      <span className="lr-shared-icon">{metadata.outputType === 'flashcards' ? <Layers3 /> : <ClipboardCheck />}</span>
      <div className="lr-shared-kicker"><Share2 /> Shared study set</div>
      <h1>{metadata.title}</h1>
      <p>{metadata.itemCount} {metadata.outputType === 'flashcards' ? 'flashcards' : 'practice questions'} prepared in Stranerd Library.</p>
      {error && <div className="lr-alert" role="alert"><AlertTriangle />{error}</div>}
      <button className="lr-shared-action" disabled={opening} onClick={() => void openStudy()}>{opening ? <><LoaderCircle className="spin" />Opening...</> : <>{metadata.outputType === 'flashcards' ? 'Study flashcards' : 'Take test'}<ArrowRight /></>}</button>
      {!user && <small>Sign in to study this shared set.</small>}
    </article>}
  </div></main>
}

function SparkLogo() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"/><path d="m15.5 8.5-2.4 5.6-5.6 2.4 2.4-5.6 5.6-2.4Z"/></svg> }

export default SharedLibraryPage

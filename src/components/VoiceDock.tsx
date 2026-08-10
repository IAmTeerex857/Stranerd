import { useEffect, useRef, useState } from 'react'
import { Captions, Mic, MicOff, PhoneOff } from 'lucide-react'
import { startRealtimeSession, type VoiceStatus } from '../lib/realtime'
import { useAuth } from '../auth-context'
import { AIActionError } from '../lib/ai'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Props = { mode: 'mentor' | 'lab' | 'assessment'; modelId: string; context: unknown; onInsufficientCredits: () => void; onStudentCaption?: (text: string) => void; embedded?: boolean }

export function VoiceDock({ mode, modelId, context, onInsufficientCredits, onStudentCaption, embedded = false }: Props) {
  const { user, setBalance } = useAuth()
  const [status, setStatus] = useState<VoiceStatus>()
  const [muted, setMuted] = useState(false)
  const [endsAt, setEndsAt] = useState<number>()
  const [now, setNow] = useState(0)
  const [captions, setCaptions] = useState<{ role: string; text: string }[]>([])
  const [error, setError] = useState<string>()
  const controller = useRef<Awaited<ReturnType<typeof startRealtimeSession>> | undefined>(undefined)
  const studentCaption = useRef(onStudentCaption)

  useEffect(() => { controller.current?.sendContext(context) }, [context])
  useEffect(() => { studentCaption.current = onStudentCaption }, [onStudentCaption])
  useEffect(() => { if (!endsAt) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [endsAt])
  useEffect(() => () => controller.current?.stop(), [])

  async function start() {
    if (!user) { window.location.assign('/login?next=/app'); return }
    setStatus('connecting'); setError(undefined); setCaptions([])
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      const next = await startRealtimeSession({ mode, modelId, context, stream, onStatus: setStatus, onError: setError, onCaption: (role, text) => { setCaptions((current) => [...current, { role, text }].slice(-20)); if (role === 'student') studentCaption.current?.(text) } })
      controller.current = next; setBalance(next.balance); setNow(Date.now()); setEndsAt(next.endsAt)
    } catch (cause) {
      if (cause instanceof AIActionError && cause.balance) setBalance(cause.balance)
      if (cause instanceof AIActionError && cause.code === 'insufficient_credits') onInsufficientCredits()
      setStatus('error'); setError(cause instanceof Error ? cause.message : 'Voice could not be started.')
    }
  }

  if (!status || status === 'ended' || status === 'error') return <section className={`voice-entry ${embedded ? 'embedded' : ''}`}><div className={`voice-orb ${status === 'error' ? 'error' : 'idle'}`} aria-hidden="true"><i /><i /><i /><span><Mic /></span></div><div className="voice-intro"><Badge variant="secondary">10 credits for 5 minutes</Badge><h2>Talk through the anatomy.</h2><p>Ask questions naturally, interrupt explanations, or work through the current Lab and assessment context.</p></div><Button size="lg" onClick={start}><Mic />Start Voice</Button>{error && <span className="voice-error" role="alert">{error}</span>}</section>
  const seconds = Math.max(0, Math.ceil(((endsAt ?? now) - now) / 1000))
  return <section className={`voice-dock ${embedded ? 'embedded' : ''}`} aria-label="Stranerd Voice"><header><Badge variant="outline">{status}</Badge><time>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</time></header><div className={`voice-orb ${status}`} aria-hidden="true"><i /><i /><i /><span>{muted ? <MicOff /> : <Mic />}</span></div><div className="voice-state"><h2>{status === 'speaking' ? 'Mentor is explaining' : status === 'connecting' ? 'Connecting securely' : muted ? 'Microphone muted' : 'Listening'}</h2><p>{status === 'speaking' ? 'Interrupt at any point to ask a follow-up.' : 'Speak naturally about the current anatomy context.'}</p></div><div className="voice-captions" aria-live="polite">{captions.slice(-2).map((caption, index) => <p key={`${caption.role}-${index}`}><span>{caption.role}</span>{caption.text}</p>)}</div><footer><Button variant="outline" size="icon" onClick={() => { const next = !muted; setMuted(next); controller.current?.mute(next) }} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>{muted ? <MicOff /> : <Mic />}</Button><Button variant="outline" size="icon" title="Captions are on"><Captions /></Button><Button variant="destructive" size="icon" onClick={() => controller.current?.stop()} aria-label="End voice session"><PhoneOff /></Button></footer></section>
}

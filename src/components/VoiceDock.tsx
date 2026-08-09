import { useEffect, useRef, useState } from 'react'
import { Captions, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react'
import { startRealtimeSession, type VoiceStatus } from '../lib/realtime'
import { useAuth } from '../auth-context'
import { AIActionError } from '../lib/ai'

type Props = { mode: 'mentor' | 'lab' | 'assessment'; modelId: string; context: unknown; onInsufficientCredits: () => void; onStudentCaption?: (text: string) => void }

export function VoiceDock({ mode, modelId, context, onInsufficientCredits, onStudentCaption }: Props) {
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
      const next = await startRealtimeSession({ mode, modelId, context, stream, onStatus: setStatus, onCaption: (role, text) => { setCaptions((current) => [...current, { role, text }].slice(-20)); if (role === 'student') studentCaption.current?.(text) } })
      controller.current = next; setBalance(next.balance); setNow(Date.now()); setEndsAt(next.endsAt)
    } catch (cause) {
      if (cause instanceof AIActionError && cause.balance) setBalance(cause.balance)
      if (cause instanceof AIActionError && cause.code === 'insufficient_credits') onInsufficientCredits()
      setStatus('error'); setError(cause instanceof Error ? cause.message : 'Voice could not be started.')
    }
  }

  if (!status || status === 'ended' || status === 'error') return <div className="voice-entry"><button onClick={start}><Mic size={15} />Voice · 10 credits / 5 min</button>{error && <span role="alert">{error}</span>}</div>
  const seconds = Math.max(0, Math.ceil(((endsAt ?? now) - now) / 1000))
  return <aside className="voice-dock" aria-label="Stranerd Voice"><header><Volume2 size={15} /><strong>{status}</strong><time>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</time></header><div className="voice-captions" aria-live="polite">{captions.slice(-2).map((caption, index) => <p key={`${caption.role}-${index}`}><span>{caption.role}</span>{caption.text}</p>)}</div><footer><button onClick={() => { const next = !muted; setMuted(next); controller.current?.mute(next) }} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>{muted ? <MicOff /> : <Mic />}</button><button title="Captions are on"><Captions /></button><button onClick={() => controller.current?.stop()} aria-label="End voice session"><PhoneOff /></button></footer></aside>
}

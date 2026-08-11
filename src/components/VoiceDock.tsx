import { useEffect, useRef, useState } from 'react'
import { Captions, Mic, MicOff, PhoneOff } from 'lucide-react'
import { startRealtimeSession, type VoiceStatus } from '../lib/realtime'
import { useAuth } from '../auth-context'
import { AIActionError } from '../lib/ai'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { VoiceAction, VoiceActionResult, VoiceMode } from '../lib/voiceActions'

type Props = { mode: VoiceMode; modelId: string; context: unknown; onAction: (action: VoiceAction) => VoiceActionResult | Promise<VoiceActionResult>; onInsufficientCredits: () => void; onStudentCaption?: (text: string) => void; embedded?: boolean }

export function VoiceDock({ mode, modelId, context, onAction, onInsufficientCredits, onStudentCaption, embedded = false }: Props) {
  const { user, setBalance } = useAuth()
  const [status, setStatus] = useState<VoiceStatus>()
  const [muted, setMuted] = useState(false)
  const [endsAt, setEndsAt] = useState<number>()
  const [now, setNow] = useState(0)
  const [captions, setCaptions] = useState<{ role: string; text: string }[]>([])
  const [error, setError] = useState<string>()
  const controller = useRef<Awaited<ReturnType<typeof startRealtimeSession>> | undefined>(undefined)
  const startVersion = useRef(0)
  const startAbort = useRef<AbortController | undefined>(undefined)
  const studentCaption = useRef(onStudentCaption)
  const actionHandler = useRef(onAction)

  useEffect(() => { controller.current?.sendContext(context) }, [context])
  useEffect(() => { studentCaption.current = onStudentCaption }, [onStudentCaption])
  useEffect(() => { actionHandler.current = onAction }, [onAction])
  useEffect(() => { if (!endsAt) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [endsAt])
  useEffect(() => () => {
    startVersion.current += 1
    startAbort.current?.abort()
    controller.current?.stop()
  }, [])

  async function start() {
    if (!user) { window.location.assign('/login?next=/app'); return }
    const version = ++startVersion.current
    startAbort.current?.abort()
    const abort = new AbortController()
    startAbort.current = abort
    setStatus('connecting'); setError(undefined); setCaptions([])
    let stream: MediaStream | undefined
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      if (version !== startVersion.current) { stream.getTracks().forEach((track) => track.stop()); return }
      const next = await startRealtimeSession({ mode, modelId, context, stream, signal: abort.signal, onAction: (action) => actionHandler.current(action), onStatus: setStatus, onError: setError, onExtended: (nextEndsAt, balance) => { setEndsAt(nextEndsAt); setBalance(balance); setError(undefined) }, onExtensionFailed: (message, insufficientCredits) => { setError(message); if (insufficientCredits) onInsufficientCredits() }, onCaption: (role, text) => { setCaptions((current) => [...current, { role, text }].slice(-20)); if (role === 'student') studentCaption.current?.(text) } })
      if (version !== startVersion.current) { next.stop(); return }
      controller.current = next; setBalance(next.balance); setNow(Date.now()); setEndsAt(next.endsAt)
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop())
      if (version !== startVersion.current || abort.signal.aborted) return
      if (cause instanceof AIActionError && cause.balance) setBalance(cause.balance)
      if (cause instanceof AIActionError && cause.code === 'insufficient_credits') onInsufficientCredits()
      setStatus('error'); setError(cause instanceof Error ? cause.message : 'Voice could not be started.')
    }
  }

  if (!status || status === 'ended' || status === 'error') return <section className={`voice-entry ${embedded ? 'embedded' : ''}`}><div className={`voice-orb ${status === 'error' ? 'error' : 'idle'}`} aria-hidden="true"><i /><i /><i /><span><Mic /></span></div><div className="voice-intro"><h2>Talk through the anatomy.</h2><p>Ask questions naturally, interrupt explanations, or work through the current Lab and assessment context.</p></div><Button variant="ai" size="lg" onClick={start}><Mic />Talk</Button>{error && <span className="voice-error" role="alert">{error}</span>}</section>
  const seconds = Math.max(0, Math.ceil(((endsAt ?? now) - now) / 1000))
  return <section className={`voice-dock ${embedded ? 'embedded' : ''}`} aria-label="Stranerd Voice"><header><Badge variant="outline">{status}</Badge><time>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</time></header><div className={`voice-orb ${status}`} aria-hidden="true"><i /><i /><i /><span>{muted ? <MicOff /> : <Mic />}</span></div><div className="voice-state"><h2>{status === 'speaking' ? 'Mentor is explaining' : status === 'connecting' ? 'Connecting securely' : muted ? 'Microphone muted' : 'Listening'}</h2><p>{status === 'speaking' ? 'Interrupt at any point to ask a follow-up.' : 'Speak naturally about the current anatomy context.'}</p></div><div className="voice-captions" aria-live="polite">{captions.slice(-2).map((caption, index) => <p key={`${caption.role}-${index}`}><span>{caption.role}</span>{caption.text}</p>)}</div>{error && <span className="voice-error" role="alert">{error}</span>}<footer><Button variant="outline" size="icon" onClick={() => { const next = !muted; setMuted(next); controller.current?.mute(next) }} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>{muted ? <MicOff /> : <Mic />}</Button><Button variant="outline" size="icon" title="Captions are on"><Captions /></Button><Button variant="destructive" size="icon" onClick={() => controller.current?.stop()} aria-label="End voice session"><PhoneOff /></Button></footer></section>
}

import { useEffect, useState } from 'react'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import { Captions, Mic, MicOff, PhoneOff, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { VoiceStatus } from '../lib/realtime'
import type { VoiceCore } from '../lib/useVoiceCore'

type Props = { voice: VoiceCore; embedded?: boolean }

function orbState(status: VoiceStatus | 'idle', muted = false): OrbState {
  if (muted || status === 'muted' || status === 'idle' || status === 'ended' || status === 'error') return 'breathing'
  if (status === 'listening') return 'listening'
  if (status === 'connecting') return 'connecting'
  return status === 'speaking' ? 'composing' : 'breathing'
}

function voiceLabel(status: VoiceStatus | undefined, muted: boolean) {
  if (muted || status === 'muted') return 'Muted'
  if (status === 'speaking') return 'Nerd Bot'
  if (status === 'thinking') return 'Thinking'
  if (status === 'connecting') return 'Connecting'
  return 'Listening'
}

function useVoiceSeconds(endsAt?: number) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!endsAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [endsAt])
  return Math.max(0, Math.ceil(((endsAt ?? now) - now) / 1000))
}

function VoiceCountdown({ endsAt }: { endsAt?: number }) {
  const seconds = useVoiceSeconds(endsAt)
  return <time>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</time>
}

export function NerdBotOrb({ status = 'idle', muted = false, className = '' }: { status?: VoiceStatus | 'idle'; muted?: boolean; className?: string }) {
  return <span className={`voice-orb thinking-orb ${muted ? 'muted' : status} ${className}`.trim()} aria-hidden="true"><ThinkingOrb state={orbState(status, muted)} size={64} theme="dark" speed={status === 'speaking' ? 1.25 : 1} /></span>
}

export function VoiceSessionCuff({ voice, compact = false }: { voice: Pick<VoiceCore, 'status' | 'muted' | 'endsAt'>; compact?: boolean }) {
  return <span className={`voice-session-cuff ${compact ? 'compact' : ''}`}><NerdBotOrb status={voice.status} muted={voice.muted} /><span className="voice-cuff-copy"><b>{voiceLabel(voice.status, voice.muted)}</b><VoiceCountdown endsAt={voice.endsAt} /></span></span>
}

export function VoiceDock({ voice, embedded = false }: Props) {
  const { status, muted, endsAt, captions, error } = voice
  if (!status || status === 'ended' || status === 'error') return <section className={`voice-entry ${embedded ? 'embedded' : ''}`}><NerdBotOrb status={status ?? 'idle'} /><div className="voice-intro"><span className="voice-kicker">Realtime voice</span><h2>Talk through the anatomy.</h2><p>Ask naturally, interrupt explanations, or work through the current Lab and assessment context.</p></div><Button variant="ai" size="lg" onClick={() => void voice.start()}><Mic />Start voice <b><Zap size={11} />10</b></Button>{error && <span className="voice-error" role="alert">{error}</span>}</section>
  return <section className={`voice-dock ${embedded ? 'embedded' : ''}`} aria-label="Stranerd Voice"><header><Badge variant="outline"><i />{status}</Badge><VoiceCountdown endsAt={endsAt} /></header><NerdBotOrb status={status} muted={muted} /><div className="voice-state"><h2>{status === 'speaking' ? 'Nerd Bot is explaining' : status === 'thinking' ? 'Nerd Bot is thinking' : status === 'connecting' ? 'Connecting securely' : muted ? 'Microphone muted' : 'Listening'}</h2><p>{status === 'speaking' ? 'Interrupt at any point to ask a follow-up.' : status === 'thinking' ? 'Preparing a response from your current learning context.' : 'Speak naturally about the current learning context.'}</p></div><div className="voice-captions" data-voice-captions hidden={captions.length === 0} aria-live="polite">{captions.slice(-2).map((caption, index) => <p key={`${caption.role}-${index}`}><span>{caption.role}</span>{caption.text}</p>)}</div>{error && <span className="voice-error" role="alert">{error}</span>}<small className="voice-renewal">Extension requires confirmation · 10 credits per 5 minutes</small><footer><Button variant="outline" size="icon" onClick={voice.toggleMute} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>{muted ? <MicOff /> : <Mic />}</Button><Button variant="outline" size="icon" title="Captions are on" aria-label="Captions are on"><Captions /></Button><Button variant="destructive" size="icon" onClick={voice.end} aria-label="End voice session"><PhoneOff /></Button></footer></section>
}

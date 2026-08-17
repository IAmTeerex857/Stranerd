import { useEffect, useState } from 'react'
import { Captions, Mic, MicOff, PhoneOff, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { VoiceCore } from '../lib/useVoiceCore'

type Props = { voice: VoiceCore; embedded?: boolean }

export function VoiceDock({ voice, embedded = false }: Props) {
  const [now, setNow] = useState(Date.now)
  const { status, muted, endsAt, captions, error } = voice
  useEffect(() => { if (!endsAt) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [endsAt])

  if (!status || status === 'ended' || status === 'error') return <section className={`voice-entry ${embedded ? 'embedded' : ''}`}><div className={`voice-orb ${status === 'error' ? 'error' : 'idle'}`} aria-hidden="true"><i /><i /><i /><span><Mic /></span></div><div className="voice-intro"><span className="voice-kicker">Realtime voice</span><h2>Talk through the anatomy.</h2><p>Ask naturally, interrupt explanations, or work through the current Lab and assessment context.</p></div><Button variant="ai" size="lg" onClick={() => void voice.start()}><Mic />Start voice <b><Sparkles size={11} />10</b></Button><small className="voice-cost">10 credits starts a 5-minute session</small>{error && <span className="voice-error" role="alert">{error}</span>}</section>
  const seconds = Math.max(0, Math.ceil(((endsAt ?? now) - now) / 1000))
  return <section className={`voice-dock ${embedded ? 'embedded' : ''}`} aria-label="Stranerd Voice"><header><Badge variant="outline"><i />{status}</Badge><time>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</time></header><div className={`voice-orb ${muted ? 'muted' : status}`} aria-hidden="true"><i /><i /><i /><span>{muted ? <MicOff /> : <Mic />}</span></div><div className="voice-state"><h2>{status === 'speaking' ? 'Nerd Bot is explaining' : status === 'connecting' ? 'Connecting securely' : muted ? 'Microphone muted' : 'Listening'}</h2><p>{status === 'speaking' ? 'Interrupt at any point to ask a follow-up.' : 'Speak naturally about the current anatomy context.'}</p></div><div className="voice-captions" data-voice-captions hidden={captions.length === 0} aria-live="polite">{captions.slice(-2).map((caption, index) => <p key={`${caption.role}-${index}`}><span>{caption.role}</span>{caption.text}</p>)}</div>{error && <span className="voice-error" role="alert">{error}</span>}<small className="voice-renewal">Extension requires confirmation · 10 credits per 5 minutes</small><footer><Button variant="outline" size="icon" onClick={voice.toggleMute} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>{muted ? <MicOff /> : <Mic />}</Button><Button variant="outline" size="icon" title="Captions are on" aria-label="Captions are on"><Captions /></Button><Button variant="destructive" size="icon" onClick={voice.end} aria-label="End voice session"><PhoneOff /></Button></footer></section>
}

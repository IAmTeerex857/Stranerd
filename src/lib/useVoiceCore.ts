import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth-context'
import { AIActionError } from './ai'
import { startRealtimeSession, type VoiceStatus } from './realtime'
import { sanitizeVoiceContext, type VoiceAction, type VoiceActionResult, type VoiceMode } from './voiceActions'

const invalidContextMessage = 'Voice is waiting for valid workspace context.'

export type VoiceCore = {
  status?: VoiceStatus
  muted: boolean
  endsAt?: number
  captions: { role: string; text: string }[]
  error?: string
  start: () => Promise<void>
  end: () => void
  toggleMute: () => void
}

export function useVoiceCore(input: { mode: VoiceMode; modelId: string; context: unknown; onAction: (action: VoiceAction) => VoiceActionResult | Promise<VoiceActionResult>; onInsufficientCredits: () => void }): VoiceCore {
  const { user, setBalance } = useAuth()
  const [status, setStatus] = useState<VoiceStatus>()
  const [muted, setMuted] = useState(false)
  const mutedRef = useRef(false)
  const [endsAt, setEndsAt] = useState<number>()
  const [captions, setCaptions] = useState<{ role: string; text: string }[]>([])
  const [error, setError] = useState<string>()
  const controller = useRef<Awaited<ReturnType<typeof startRealtimeSession>> | undefined>(undefined)
  const starting = useRef(false)
  const startVersion = useRef(0)
  const startAbort = useRef<AbortController | undefined>(undefined)
  const latest = useRef(input)
  const fingerprint = useRef<string | undefined>(undefined)
  const contextFrame = useRef(0)
  const hadUser = useRef(Boolean(user))

  useEffect(() => { latest.current = input }, [input])
  useEffect(() => {
    window.cancelAnimationFrame(contextFrame.current)
    contextFrame.current = window.requestAnimationFrame(() => {
      const current = latest.current
      const sanitized = sanitizeVoiceContext(current.mode, current.context)
      if (!sanitized || sanitized.fingerprint === fingerprint.current) return
      fingerprint.current = sanitized.fingerprint
      controller.current?.sendContext(sanitized.context)
    })
    return () => window.cancelAnimationFrame(contextFrame.current)
  }, [input.context, input.mode])
  useEffect(() => {
    if (status !== 'error' || error !== invalidContextMessage || !sanitizeVoiceContext(input.mode, input.context)) return
    const frame = window.requestAnimationFrame(() => {
      setStatus(undefined)
      setError(undefined)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [error, input.context, input.mode, status])
  useEffect(() => {
    if (hadUser.current && !user) controller.current?.stop('signed_out')
    hadUser.current = Boolean(user)
  }, [user])
  useEffect(() => {
    const unload = () => controller.current?.stop('pagehide')
    window.addEventListener('pagehide', unload)
    return () => {
      window.removeEventListener('pagehide', unload)
      window.cancelAnimationFrame(contextFrame.current)
      startVersion.current += 1
      startAbort.current?.abort()
      controller.current?.stop('app_unmounted')
    }
  }, [])

  async function start() {
    if (controller.current || starting.current || status === 'connecting') return
    if (!user) { window.location.assign('/login?next=/app'); return }
    const sanitized = sanitizeVoiceContext(latest.current.mode, latest.current.context)
    if (!sanitized) { setStatus('error'); setError(invalidContextMessage); return }
    const version = ++startVersion.current
    starting.current = true
    startAbort.current?.abort()
    const abort = new AbortController()
    startAbort.current = abort
    setStatus('connecting')
    mutedRef.current = false
    setMuted(false)
    setEndsAt(undefined)
    setError(undefined)
    setCaptions([])
    let stream: MediaStream | undefined
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      if (version !== startVersion.current) { stream.getTracks().forEach((track) => track.stop()); return }
      const connectionInput = latest.current
      const connectionContext = sanitizeVoiceContext(connectionInput.mode, connectionInput.context)
      if (!connectionContext) throw new Error('Voice is waiting for valid workspace context.')
      const next = await startRealtimeSession({
        mode: connectionInput.mode,
        modelId: connectionInput.modelId,
        context: connectionContext.context,
        stream,
        signal: abort.signal,
        onAction: (action) => latest.current.onAction(action),
        onStatus: (nextStatus) => { setStatus(mutedRef.current && (nextStatus === 'listening' || nextStatus === 'speaking') ? 'muted' : nextStatus); if (nextStatus === 'ended' || nextStatus === 'error') { controller.current = undefined; mutedRef.current = false; setMuted(false); setEndsAt(undefined) } },
        onError: setError,
        onExtended: (nextEndsAt, balance) => { setEndsAt(nextEndsAt); setBalance(balance); setError(undefined) },
        onExtensionFailed: (message, insufficientCredits) => { setError(message); if (insufficientCredits) latest.current.onInsufficientCredits() },
        onRenewalRequired: () => window.confirm('Continue Voice for another 5 minutes for 10 credits?'),
        onCaption: (role, text) => setCaptions((current) => [...current, { role, text }].slice(-20)),
      })
      if (version !== startVersion.current) { next.stop('superseded'); return }
      controller.current = next
      fingerprint.current = connectionContext.fingerprint
      const currentContext = sanitizeVoiceContext(latest.current.mode, latest.current.context)
      if (currentContext && currentContext.fingerprint !== fingerprint.current) {
        fingerprint.current = currentContext.fingerprint
        next.sendContext(currentContext.context)
      }
      setBalance(next.balance)
      setEndsAt(next.endsAt)
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop())
      if (version !== startVersion.current || abort.signal.aborted) return
      if (cause instanceof AIActionError && cause.balance) setBalance(cause.balance)
      if (cause instanceof AIActionError && cause.code === 'insufficient_credits') latest.current.onInsufficientCredits()
      setStatus('error')
      setError(cause instanceof Error ? cause.message : 'Voice could not be started.')
    } finally {
      if (version === startVersion.current) starting.current = false
    }
  }

  function end() {
    startVersion.current += 1
    starting.current = false
    startAbort.current?.abort()
    controller.current?.stop('user_ended')
    controller.current = undefined
    mutedRef.current = false
    setMuted(false)
    setEndsAt(undefined)
    setStatus('ended')
  }

  function toggleMute() {
    const next = !muted
    mutedRef.current = next
    setMuted(next)
    setStatus(next ? 'muted' : 'listening')
    controller.current?.mute(next)
  }

  return { status, muted, endsAt, captions, error, start, end, toggleMute }
}

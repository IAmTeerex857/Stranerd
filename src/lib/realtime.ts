import { supabase } from './supabase'
import { AIActionError, type CreditBalance } from './ai'
import { createLatestValueQueue, createRealtimeFunctionHandler, type VoiceAction, type VoiceActionResult, type VoiceMode } from './voiceActions'

export type VoiceStatus = 'connecting' | 'listening' | 'speaking' | 'muted' | 'ended' | 'error'

export const VOICE_EXTENSION_LEAD_MS = 30_000

export function voiceRenewalDelay(endsAt: number, now = Date.now()) {
  return Math.max(0, endsAt - now - VOICE_EXTENSION_LEAD_MS)
}

export function realtimeToolOutputEvents(callId: string, result: VoiceActionResult, eventId: () => string = () => crypto.randomUUID()) {
  return [
    { event_id: eventId(), type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result) } },
    { event_id: eventId(), type: 'response.create' },
  ]
}

export async function startRealtimeSession(input: { mode: VoiceMode; modelId: string; context: unknown; stream: MediaStream; signal?: AbortSignal; onStatus: (status: VoiceStatus) => void; onCaption: (role: 'student' | 'mentor', text: string) => void; onError: (message: string) => void; onExtended: (endsAt: number, balance: CreditBalance) => void; onExtensionFailed: (message: string, insufficientCredits: boolean) => void; onAction?: (action: VoiceAction) => VoiceActionResult | Promise<VoiceActionResult> }) {
  if (!supabase) throw new AIActionError('authentication_required', 'Sign in to use Voice.', 401)
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new AIActionError('authentication_required', 'Sign in to use Voice.', 401)
  const peer = new RTCPeerConnection()
  input.stream.getTracks().forEach((track) => peer.addTrack(track, input.stream))
  const audio = new Audio()
  audio.autoplay = true
  peer.ontrack = (event) => { audio.srcObject = event.streams[0] }
  const channel = peer.createDataChannel('oai-events')
  const sendContextMessage = (context: unknown) => channel.send(JSON.stringify({ event_id: crypto.randomUUID(), type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: `Updated Stranerd state: ${JSON.stringify(context)}` }] } }))
  const contextQueue = createLatestValueQueue(() => channel.readyState === 'open', sendContextMessage)
  const handleFunctionCall = createRealtimeFunctionHandler(input.onAction, (callId, result) => {
    if (channel.readyState !== 'open') return
    realtimeToolOutputEvents(callId, result).forEach((outputEvent) => channel.send(JSON.stringify(outputEvent)))
  })
  channel.onopen = () => contextQueue.flush()
  channel.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as { type?: string; transcript?: string; error?: { message?: string }; response?: { status?: string; status_details?: { error?: { message?: string } } } }
      void handleFunctionCall(message)
      if (message.type === 'input_audio_buffer.speech_started') input.onStatus('listening')
      if (message.type === 'response.audio.delta' || message.type === 'response.output_audio.delta' || message.type === 'output_audio_buffer.started') input.onStatus('speaking')
      if ((message.type === 'response.audio_transcript.done' || message.type === 'response.output_audio_transcript.done') && message.transcript) input.onCaption('mentor', message.transcript)
      if (message.type === 'conversation.item.input_audio_transcription.completed' && message.transcript) input.onCaption('student', message.transcript)
      if (message.type === 'response.done' && message.response?.status === 'failed') input.onError(message.response.status_details?.error?.message || 'The Voice response was interrupted. Please ask again.')
      else if (message.type === 'response.done') input.onStatus('listening')
      if (message.type === 'error') input.onError(message.error?.message || 'The Voice provider reported an error.')
    } catch { /* Ignore unknown provider events. */ }
  }
  let credential: { answerSdp?: string; endsAt?: number; sessionId?: string; balance?: CreditBalance; error?: string; message?: string }
  try {
    const offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
    const response = await fetch('/api/realtime/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}`, 'X-Request-ID': crypto.randomUUID() }, body: JSON.stringify({ mode: input.mode, modelId: input.modelId, context: input.context, sdp: offer.sdp }), signal: input.signal })
    credential = await response.json() as typeof credential
    if (!response.ok || !credential.answerSdp || !credential.endsAt || !credential.sessionId || !credential.balance) throw new AIActionError(credential.error || 'voice_failed', credential.message || 'Voice could not be started.', response.status, credential.balance)
    await peer.setRemoteDescription({ type: 'answer', sdp: credential.answerSdp })
  } catch (error) {
    channel.close()
    peer.close()
    input.stream.getTracks().forEach((track) => track.stop())
    throw error
  }
  input.onStatus('listening')
  let stopped = false
  let currentEndsAt = credential.endsAt
  let endTimer = 0
  let renewalTimer = 0
  let extensionRequestId = crypto.randomUUID()
  peer.onconnectionstatechange = () => {
    if (stopped || !['failed', 'closed'].includes(peer.connectionState)) return
    fail('The Voice connection ended unexpectedly. Start a new session to continue.')
  }
  channel.onerror = () => { if (!stopped) input.onError('The Voice data connection encountered an error.') }
  channel.onclose = () => { if (!stopped && peer.connectionState !== 'closed') fail('The Voice connection ended unexpectedly. Start a new session to continue.') }

  function clearTimers() { window.clearTimeout(endTimer); window.clearTimeout(renewalTimer) }
  function close() { clearTimers(); channel.close(); peer.close(); input.stream.getTracks().forEach((track) => track.stop()); audio.srcObject = null }
  function fail(message: string) { if (stopped) return; stopped = true; close(); input.onError(message); input.onStatus('error') }
  function stop() { if (stopped) return; stopped = true; close(); input.onStatus('ended') }
  function schedule() {
    clearTimers()
    endTimer = window.setTimeout(stop, Math.max(0, currentEndsAt - Date.now()))
    renewalTimer = window.setTimeout(() => void extend(), voiceRenewalDelay(currentEndsAt))
  }
  async function extend() {
    if (stopped) return
    try {
      const { data } = await supabase!.auth.getSession()
      if (!data.session) throw new AIActionError('authentication_required', 'Sign in again to continue Voice.', 401)
      const extensionResponse = await fetch('/api/realtime/extend', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}`, 'X-Request-ID': extensionRequestId }, body: JSON.stringify({ sessionId: credential.sessionId }) })
      const extension = await extensionResponse.json() as { endsAt?: number; freeBalance?: number; subscriptionBalance?: number; purchasedBalance?: number; error?: string; message?: string }
      if (!extensionResponse.ok || !extension.endsAt || extension.freeBalance === undefined || extension.subscriptionBalance === undefined || extension.purchasedBalance === undefined) throw new AIActionError(extension.error || 'voice_extension_failed', extension.message || 'Voice could not be extended.', extensionResponse.status)
      currentEndsAt = extension.endsAt
      extensionRequestId = crypto.randomUUID()
      const balance = { freeBalance: extension.freeBalance, subscriptionBalance: extension.subscriptionBalance, purchasedBalance: extension.purchasedBalance }
      input.onExtended(currentEndsAt, balance)
      schedule()
    } catch (cause) {
      const insufficient = cause instanceof AIActionError && cause.code === 'insufficient_credits'
      input.onExtensionFailed(cause instanceof Error ? cause.message : 'Voice could not be extended.', insufficient)
      if (!insufficient && currentEndsAt - Date.now() > 7_000) renewalTimer = window.setTimeout(() => void extend(), 5_000)
    }
  }
  schedule()
  function mute(value: boolean) { input.stream.getAudioTracks().forEach((track) => { track.enabled = !value }); input.onStatus(value ? 'muted' : 'listening') }
  function sendContext(context: unknown) { contextQueue.push(context) }
  return { balance: credential.balance, endsAt: currentEndsAt, stop, mute, sendContext }
}

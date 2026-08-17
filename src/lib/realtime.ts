import { supabase } from './supabase'
import { AIActionError, type CreditBalance } from './ai'
import { createLatestValueQueue, createRealtimeFunctionHandler, type VoiceAction, type VoiceActionResult, type VoiceMode } from './voiceActions'

export type VoiceStatus = 'connecting' | 'listening' | 'speaking' | 'muted' | 'ended' | 'error'

export const VOICE_EXTENSION_LEAD_MS = 30_000

export function voiceRenewalDelay(endsAt: number, now = Date.now()) {
  return Math.max(0, endsAt - now - VOICE_EXTENSION_LEAD_MS)
}

export async function confirmVoiceExtension(confirm: () => boolean | Promise<boolean>) {
  return (await confirm()) === true
}

export function realtimeToolOutputEvents(callId: string, result: VoiceActionResult, eventId: () => string = () => crypto.randomUUID(), requestResponse = true) {
  let output = JSON.stringify(result)
  if (output.length > 12_000 && result.ok && result.context !== undefined) output = JSON.stringify({ ...result, context: undefined })
  if (output.length > 12_000) output = JSON.stringify({ ok: false, error: 'The voice action result was too large to return safely.' })
  return [
    { event_id: eventId(), type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output } },
    ...(requestResponse ? [{ event_id: eventId(), type: 'response.create' }] : []),
  ]
}

export async function startRealtimeSession(input: { mode: VoiceMode; modelId: string; context: unknown; stream: MediaStream; signal?: AbortSignal; onStatus: (status: VoiceStatus) => void; onCaption: (role: 'student' | 'mentor', text: string) => void; onError: (message: string) => void; onExtended: (endsAt: number, balance: CreditBalance) => void; onExtensionFailed: (message: string, insufficientCredits: boolean) => void; onRenewalRequired: (endsAt: number) => boolean | Promise<boolean>; onAction?: (action: VoiceAction) => VoiceActionResult | Promise<VoiceActionResult> }) {
  if (!supabase) throw new AIActionError('authentication_required', 'Sign in to use Voice.', 401)
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new AIActionError('authentication_required', 'Sign in to use Voice.', 401)
  const peer = new RTCPeerConnection()
  input.stream.getTracks().forEach((track) => peer.addTrack(track, input.stream))
  const audio = new Audio()
  audio.autoplay = true
  peer.ontrack = (event) => {
    audio.srcObject = event.streams[0]
    void audio.play().catch(() => input.onError('Voice audio was blocked. Allow audio playback in this browser to hear Nerd Bot.'))
  }
  const channel = peer.createDataChannel('oai-events')
  const sendContextMessage = (context: unknown) => channel.send(JSON.stringify({ event_id: crypto.randomUUID(), type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: `Updated Stranerd state: ${JSON.stringify(context)}` }] } }))
  const contextQueue = createLatestValueQueue(() => channel.readyState === 'open', sendContextMessage)
  const handleFunctionCall = createRealtimeFunctionHandler(input.onAction, (callId, result) => {
    if (channel.readyState !== 'open') return
    realtimeToolOutputEvents(callId, result, () => crypto.randomUUID(), false).forEach((outputEvent) => channel.send(JSON.stringify(outputEvent)))
  }, 10_000, () => {
    if (channel.readyState === 'open') channel.send(JSON.stringify({ event_id: crypto.randomUUID(), type: 'response.create' }))
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
      if (message.type === 'response.done' && message.response?.status === 'failed') fail(message.response.status_details?.error?.message || 'The Voice session failed. Start a new session to continue.', 'provider_response_failed')
      else if (message.type === 'response.done') input.onStatus('listening')
      if (message.type === 'error') fail(message.error?.message || 'The Voice provider reported an error.', 'provider_error')
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
  let disconnectTimer = 0
  let renewalDecided = false
  let extensionRequestId = crypto.randomUUID()
  peer.onconnectionstatechange = () => {
    window.clearTimeout(disconnectTimer)
    if (stopped) return
    if (peer.connectionState === 'disconnected') disconnectTimer = window.setTimeout(() => fail('The Voice connection was lost. Start a new session to continue.', 'disconnected'), 5_000)
    else if (['failed', 'closed'].includes(peer.connectionState)) fail('The Voice connection ended unexpectedly. Start a new session to continue.', 'connection_failed')
  }
  channel.onerror = () => { if (!stopped) fail('The Voice data connection encountered an error.', 'data_channel_error') }
  channel.onclose = () => { if (!stopped && peer.connectionState !== 'closed') fail('The Voice connection ended unexpectedly. Start a new session to continue.', 'data_channel_closed') }
  input.stream.getTracks().forEach((track) => { track.onended = () => { if (!stopped) fail('Microphone access ended. Start a new session to continue.', 'track_ended') } })

  function clearTimers() { window.clearTimeout(endTimer); window.clearTimeout(renewalTimer); window.clearTimeout(disconnectTimer) }
  function close() { clearTimers(); channel.close(); peer.close(); input.stream.getTracks().forEach((track) => track.stop()); audio.srcObject = null }
  function notifyEnd(reason: string, status: 'ended' | 'failed' | 'expired') {
    void fetch('/api/realtime/end', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session!.access_token}` }, body: JSON.stringify({ sessionId: credential.sessionId, status, reason }) })
  }
  function fail(message: string, reason: string) { if (stopped) return; stopped = true; close(); notifyEnd(reason, 'failed'); input.onError(message); input.onStatus('error') }
  function stop(reason = 'user_ended') { if (stopped) return; stopped = true; close(); notifyEnd(reason, reason === 'expired' ? 'expired' : 'ended'); input.onStatus('ended') }
  function schedule() {
    clearTimers()
    renewalDecided = false
    endTimer = window.setTimeout(() => stop('expired'), Math.max(0, currentEndsAt - Date.now()))
    renewalTimer = window.setTimeout(() => void requestExtension(), voiceRenewalDelay(currentEndsAt))
  }
  async function requestExtension() {
    if (stopped || renewalDecided) return
    renewalDecided = true
    if (await confirmVoiceExtension(() => input.onRenewalRequired(currentEndsAt))) await extend()
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
    }
  }
  schedule()
  function mute(value: boolean) { input.stream.getAudioTracks().forEach((track) => { track.enabled = !value }); input.onStatus(value ? 'muted' : 'listening') }
  function sendContext(context: unknown) { contextQueue.push(context) }
  return { balance: credential.balance, endsAt: currentEndsAt, sessionId: credential.sessionId, stop, mute, sendContext }
}

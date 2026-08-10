import { supabase } from './supabase'
import { AIActionError, type CreditBalance } from './ai'

export type VoiceStatus = 'connecting' | 'listening' | 'speaking' | 'muted' | 'ended' | 'error'

export async function startRealtimeSession(input: { mode: 'mentor' | 'lab' | 'assessment'; modelId: string; context: unknown; stream: MediaStream; onStatus: (status: VoiceStatus) => void; onCaption: (role: 'student' | 'mentor', text: string) => void; onError: (message: string) => void }) {
  if (!supabase) throw new AIActionError('authentication_required', 'Sign in to use Voice.', 401)
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new AIActionError('authentication_required', 'Sign in to use Voice.', 401)
  const peer = new RTCPeerConnection()
  input.stream.getTracks().forEach((track) => peer.addTrack(track, input.stream))
  const audio = new Audio()
  audio.autoplay = true
  peer.ontrack = (event) => { audio.srcObject = event.streams[0] }
  const channel = peer.createDataChannel('oai-events')
  channel.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data) as { type?: string; transcript?: string }
      if (message.type === 'input_audio_buffer.speech_started') input.onStatus('listening')
      if (message.type === 'response.audio.delta' || message.type === 'response.output_audio.delta' || message.type === 'output_audio_buffer.started') input.onStatus('speaking')
      if ((message.type === 'response.audio_transcript.done' || message.type === 'response.output_audio_transcript.done') && message.transcript) input.onCaption('mentor', message.transcript)
      if (message.type === 'conversation.item.input_audio_transcription.completed' && message.transcript) input.onCaption('student', message.transcript)
      if (message.type === 'response.done') input.onStatus('listening')
    } catch { /* Ignore unknown provider events. */ }
  }
  const offer = await peer.createOffer()
  await peer.setLocalDescription(offer)
  let response: Response
  try {
    response = await fetch('/api/realtime/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}`, 'X-Request-ID': crypto.randomUUID() }, body: JSON.stringify({ mode: input.mode, modelId: input.modelId, context: input.context, sdp: offer.sdp }) })
  } catch (error) {
    peer.close()
    input.stream.getTracks().forEach((track) => track.stop())
    throw error
  }
  const credential = await response.json() as { answerSdp?: string; endsAt?: number; balance?: CreditBalance; error?: string; message?: string }
  if (!response.ok || !credential.answerSdp || !credential.endsAt || !credential.balance) { peer.close(); input.stream.getTracks().forEach((track) => track.stop()); throw new AIActionError(credential.error || 'voice_failed', credential.message || 'Voice could not be started.', response.status, credential.balance) }
  await peer.setRemoteDescription({ type: 'answer', sdp: credential.answerSdp })
  input.onStatus('listening')
  let stopped = false
  peer.onconnectionstatechange = () => {
    if (stopped || !['failed', 'closed'].includes(peer.connectionState)) return
    input.onError('The Voice connection ended unexpectedly. Start a new session to continue.')
    input.onStatus('error')
  }
  const timer = window.setTimeout(() => stop(), Math.max(0, credential.endsAt - Date.now()))
  function stop() { stopped = true; window.clearTimeout(timer); channel.close(); peer.close(); input.stream.getTracks().forEach((track) => track.stop()); audio.srcObject = null; input.onStatus('ended') }
  function mute(value: boolean) { input.stream.getAudioTracks().forEach((track) => { track.enabled = !value }); input.onStatus(value ? 'muted' : 'listening') }
  function sendContext(context: unknown) { if (channel.readyState === 'open') channel.send(JSON.stringify({ type: 'conversation.item.create', item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: `Updated Stranerd state: ${JSON.stringify(context)}` }] } })) }
  return { balance: credential.balance, endsAt: credential.endsAt, stop, mute, sendContext }
}

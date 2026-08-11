import type { Request, Response } from 'express'
import { AiRequestError, aiErrorResponse, requireAiUser, validRequestId } from '../../server/aiCredits.js'
import { serverAnatomyCatalog } from '../../server/anatomyCatalog.js'
import { VOICE_MODES, validVoiceContext, voiceToolsForMode, type VoiceMode } from '../../src/lib/voiceActions.js'

type SessionBody = { mode?: string; modelId?: string; context?: unknown; sdp?: unknown }

function realtimeProvider() {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '')
  const azureModel = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT || 'gpt-realtime-2.1'
  if (process.env.AZURE_OPENAI_API_KEY && azureEndpoint && azureModel) {
    const headers: Record<string, string> = { 'api-key': process.env.AZURE_OPENAI_API_KEY }
    return {
      model: azureModel,
      secretUrl: `${azureEndpoint}/openai/v1/realtime/client_secrets`,
      callsUrl: azureRealtimeCallsUrl(azureEndpoint),
      headers,
      transcriptionModel: process.env.AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT,
    }
  }
  if (process.env.OPENAI_API_KEY) {
    const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime'
    const headers: Record<string, string> = { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    return {
      model,
      secretUrl: 'https://api.openai.com/v1/realtime/client_secrets',
      callsUrl: `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`,
      headers,
      transcriptionModel: 'gpt-4o-mini-transcribe',
    }
  }
  throw new AiRequestError(503, 'voice_unavailable', 'Realtime Voice is not configured.')
}

export function azureRealtimeCallsUrl(endpoint: string) {
  return `${endpoint.replace(/\/$/, '')}/openai/v1/realtime/calls`
}

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') return void response.status(405).json({ message: 'Method not allowed' })
  let creditContext: { client: Awaited<ReturnType<typeof requireAiUser>>['client']; userId: string; requestId: string } | undefined
  try {
    const body = request.body as SessionBody
    const requestId = request.headers['x-request-id'] as string | undefined
    const model = serverAnatomyCatalog.find((entry) => entry.id === body.modelId)
    const mode = VOICE_MODES.find((entry) => entry === body.mode)
    if (!validRequestId(requestId) || !model || !mode || !validVoiceContext(mode, body.context) || JSON.stringify(body.context).length > 12_000 || typeof body.sdp !== 'string' || !body.sdp.startsWith('v=0') || body.sdp.length > 30_000) throw new AiRequestError(400, 'invalid_request', 'A valid voice learning context and connection offer are required.')
    const provider = realtimeProvider()
    const { client, userId } = await requireAiUser(request.headers.authorization)
    creditContext = { client, userId, requestId: requestId! }
    const { data: reserved, error: reserveError } = await client.rpc('reserve_voice_session_credits', { p_user_id: userId, p_amount: 10, p_request_id: requestId })
    if (reserveError) {
      if (reserveError.message.toLowerCase().includes('insufficient credits')) throw new AiRequestError(402, 'insufficient_credits', 'You need 10 credits for a five-minute Voice session.')
      throw new AiRequestError(500, 'credit_reservation_failed', 'Voice credits could not be reserved.')
    }
    const instructions = `You are Stranerd Voice Mentor, a concise university-level anatomy educator. This is an educational tool, not medical advice. Never diagnose, prescribe, or give patient-specific guidance. Use the supplied learning context and available tools. Ask recall questions and allow interruption. Any learner request that changes visible application state MUST be performed with the matching tool; never describe or imply that you changed the application without a tool call. Wait for the application's tool output before claiming that an action succeeded, and report tool failures honestly. In assessment mode, you may reason through the visible question and choose an answer only when the learner asks you to, but you are never given an answer key and must not claim to know the verified answer. Never submit an assessment or request a paid hint until the learner explicitly confirms that action and any charge. In Lab mode, guide the learner but never claim an objective is complete; only Stranerd validates model actions. Session context: ${JSON.stringify({ model, focus: body.context })}`
    const inputAudio = { turn_detection: { type: 'semantic_vad', create_response: true, interrupt_response: true }, ...(provider.transcriptionModel ? { transcription: { model: provider.transcriptionModel, language: 'en' } } : {}) }
    const providerResponse = await fetch(provider.secretUrl, { method: 'POST', headers: { ...provider.headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ expires_after: { anchor: 'created_at', seconds: 30 }, session: { type: 'realtime', model: provider.model, output_modalities: ['audio'], instructions, tools: voiceToolsForMode(mode as VoiceMode), tool_choice: 'auto', parallel_tool_calls: false, max_output_tokens: 4096, audio: { input: inputAudio, output: { voice: 'marin' } } } }), signal: AbortSignal.timeout(15_000) })
    const secret = await providerResponse.json() as { value?: string; expires_at?: number; session?: { id?: string } }
    if (!providerResponse.ok || !secret.value) throw new Error('Realtime credential request failed')
    const answerResponse = await fetch(provider.callsUrl, { method: 'POST', headers: { Authorization: `Bearer ${secret.value}`, 'Content-Type': 'application/sdp' }, body: body.sdp, signal: AbortSignal.timeout(20_000) })
    const answerSdp = await answerResponse.text()
    if (!answerResponse.ok || !answerSdp.startsWith('v=0')) throw new Error('Realtime connection negotiation failed')
    const now = Date.now()
    const endsAt = now + 5 * 60_000
    const { data: session, error: sessionError } = await client.from('voice_sessions').insert({ user_id: userId, request_id: requestId, reservation_id: reserved.reservationId, provider_session_id: secret.session?.id, mode: body.mode, started_at: new Date(now).toISOString(), ends_at: new Date(endsAt).toISOString() }).select('id').single()
    if (sessionError || !session) throw new Error('Voice session record failed')
    const { data: balance, error: finalError } = await client.rpc('finalize_credit_reservation', { p_user_id: userId, p_request_id: requestId })
    if (finalError) throw new AiRequestError(503, 'credit_finalization_pending', 'Voice session authorization is pending. Retry shortly.')
    response.json({ answerSdp, startedAt: now, endsAt, sessionId: session.id, balance })
  } catch (error) {
    if (creditContext && !(error instanceof AiRequestError && error.code === 'credit_finalization_pending')) await creditContext.client.rpc('refund_credit_reservation', { p_user_id: creditContext.userId, p_request_id: creditContext.requestId })
    const result = aiErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

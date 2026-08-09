import type { Request, Response } from 'express'
import { AiRequestError, aiErrorResponse, requireAiUser, validRequestId } from '../../server/aiCredits.js'
import { serverAnatomyCatalog } from '../../server/anatomyCatalog.js'

type SessionBody = { mode?: 'mentor' | 'lab' | 'assessment'; modelId?: string; context?: unknown }

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') return void response.status(405).json({ message: 'Method not allowed' })
  let creditContext: { client: Awaited<ReturnType<typeof requireAiUser>>['client']; userId: string; requestId: string } | undefined
  try {
    const body = request.body as SessionBody
    const requestId = request.headers['x-request-id'] as string | undefined
    const model = serverAnatomyCatalog.find((entry) => entry.id === body.modelId)
    if (!validRequestId(requestId) || !model || !['mentor', 'lab', 'assessment'].includes(body.mode ?? '') || JSON.stringify(body.context ?? {}).length > 12_000) throw new AiRequestError(400, 'invalid_request', 'A valid voice learning context is required.')
    if (!process.env.OPENAI_API_KEY) throw new AiRequestError(503, 'voice_unavailable', 'OpenAI Realtime is not configured.')
    const { client, userId } = await requireAiUser(request.headers.authorization)
    creditContext = { client, userId, requestId: requestId! }
    const { data: reserved, error: reserveError } = await client.rpc('reserve_voice_session_credits', { p_user_id: userId, p_amount: 10, p_request_id: requestId })
    if (reserveError) {
      if (reserveError.message.toLowerCase().includes('insufficient credits')) throw new AiRequestError(402, 'insufficient_credits', 'You need 10 credits for a five-minute Voice session.')
      throw new AiRequestError(500, 'credit_reservation_failed', 'Voice credits could not be reserved.')
    }
    const instructions = `You are Stranerd Voice Mentor, a concise university-level anatomy educator. This is an educational tool, not medical advice. Never diagnose, prescribe, or give patient-specific guidance. Use the supplied learning context. Ask recall questions and allow interruption. In assessment mode, read questions and options but never reveal or infer correct answers before submission. In Lab mode, guide the learner but never claim an objective is complete; only Stranerd validates model actions. Session context: ${JSON.stringify({ model, focus: body.context })}`
    const realtimeModel = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime'
    const providerResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expires_after: { anchor: 'created_at', seconds: 30 }, session: { type: 'realtime', model: realtimeModel, output_modalities: ['audio'], instructions, max_output_tokens: 300, audio: { input: { transcription: { model: 'gpt-4o-mini-transcribe', language: 'en' }, turn_detection: { type: 'semantic_vad', create_response: true, interrupt_response: true } }, output: { voice: 'marin' } } } }), signal: AbortSignal.timeout(15_000) })
    const secret = await providerResponse.json() as { value?: string; expires_at?: number; session?: { id?: string } }
    if (!providerResponse.ok || !secret.value) throw new Error('Realtime credential request failed')
    const now = Date.now()
    const endsAt = now + 5 * 60_000
    const { error: sessionError } = await client.from('voice_sessions').insert({ user_id: userId, request_id: requestId, reservation_id: reserved.reservationId, provider_session_id: secret.session?.id, mode: body.mode, started_at: new Date(now).toISOString(), ends_at: new Date(endsAt).toISOString() })
    if (sessionError) throw new Error('Voice session record failed')
    const { data: balance, error: finalError } = await client.rpc('finalize_credit_reservation', { p_user_id: userId, p_request_id: requestId })
    if (finalError) throw new AiRequestError(503, 'credit_finalization_pending', 'Voice session authorization is pending. Retry shortly.')
    response.json({ value: secret.value, model: realtimeModel, expiresAt: secret.expires_at, startedAt: now, endsAt, sessionId: secret.session?.id, balance })
  } catch (error) {
    if (creditContext && !(error instanceof AiRequestError && error.code === 'credit_finalization_pending')) await creditContext.client.rpc('refund_credit_reservation', { p_user_id: creditContext.userId, p_request_id: creditContext.requestId })
    const result = aiErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

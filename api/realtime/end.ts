import type { Request, Response } from 'express'
import { AiRequestError, aiErrorResponse, requireAiUser, validRequestId } from '../../server/aiCredits.js'

export function validVoiceEndEvent(value: unknown): value is { sessionId: string; status: 'ended' | 'failed' | 'expired'; reason: string } {
  const event = value !== null && typeof value === 'object' ? value as Record<string, unknown> : undefined
  return Boolean(event && typeof event.sessionId === 'string' && validRequestId(event.sessionId) && ['ended', 'failed', 'expired'].includes(String(event.status)) && typeof event.reason === 'string' && event.reason.length >= 1 && event.reason.length <= 80)
}

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') return void response.status(405).json({ message: 'Method not allowed' })
  try {
    const { sessionId, status, reason } = request.body as { sessionId?: unknown; status?: unknown; reason?: unknown }
    if (!validVoiceEndEvent({ sessionId, status, reason })) throw new AiRequestError(400, 'invalid_request', 'A valid Voice end event is required.')
    const { client, userId } = await requireAiUser(request.headers.authorization)
    const { error } = await client.rpc('end_voice_session', { p_user_id: userId, p_session_id: sessionId, p_status: status, p_reason: reason })
    if (error) throw new AiRequestError(500, 'voice_end_failed', 'Voice end state could not be recorded.')
    response.status(204).end()
  } catch (error) {
    const result = aiErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

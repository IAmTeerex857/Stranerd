import type { Request, Response } from 'express'
import { AiRequestError, aiErrorResponse, requireAiUser, validRequestId } from '../../server/aiCredits.js'

type ExtendBody = { sessionId?: unknown }

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') return void response.status(405).json({ message: 'Method not allowed' })
  try {
    const requestId = request.headers['x-request-id'] as string | undefined
    const { sessionId } = request.body as ExtendBody
    if (!validRequestId(requestId) || typeof sessionId !== 'string' || !validRequestId(sessionId)) throw new AiRequestError(400, 'invalid_request', 'A valid Voice session and request ID are required.')
    const { client, userId } = await requireAiUser(request.headers.authorization)
    const { data, error } = await client.rpc('extend_voice_session', { p_user_id: userId, p_session_id: sessionId, p_request_id: requestId })
    if (error) {
      const message = error.message.toLowerCase()
      if (message.includes('insufficient credits')) throw new AiRequestError(402, 'insufficient_credits', 'You need 10 credits to continue Voice for another five minutes.')
      if (message.includes('cannot be extended') || message.includes('not found')) throw new AiRequestError(409, 'session_not_extendable', 'This Voice session can no longer be extended.')
      throw new AiRequestError(500, 'voice_extension_failed', 'Voice could not be extended. Your current paid time is still available.')
    }
    response.json(data)
  } catch (error) {
    const result = aiErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

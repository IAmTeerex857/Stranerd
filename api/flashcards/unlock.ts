import type { Request, Response } from 'express'
import { AiRequestError, aiErrorResponse, requireAiUser, validRequestId } from '../../server/aiCredits.js'

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') return void response.status(405).json({ message: 'Method not allowed' })
  try {
    const deckId = typeof request.body?.deckId === 'string' ? request.body.deckId : ''
    const requestId = request.headers['x-request-id'] as string | undefined
    if (!validRequestId(deckId) || !validRequestId(requestId)) throw new AiRequestError(400, 'invalid_request', 'A valid deck and request ID are required.')
    const { client, userId } = await requireAiUser(request.headers.authorization)
    const { data, error } = await client.rpc('unlock_generated_flashcard_deck', { p_user_id: userId, p_deck_id: deckId, p_request_id: requestId })
    if (error) {
      if (error.message.toLowerCase().includes('insufficient credits')) throw new AiRequestError(402, 'insufficient_credits', 'You need 5 credits to unlock this deck.')
      if (error.code === 'P0002' || error.message.toLowerCase().includes('not found')) throw new AiRequestError(404, 'deck_not_found', 'This public deck is unavailable.')
      throw new AiRequestError(500, 'unlock_failed', 'The deck could not be unlocked.')
    }
    const result = data as { deckId: string; alreadyUnlocked: boolean; freeBalance: number; subscriptionBalance: number; purchasedBalance: number }
    response.json({ deckId: result.deckId, unlocked: true, alreadyUnlocked: result.alreadyUnlocked, balance: { freeBalance: result.freeBalance, subscriptionBalance: result.subscriptionBalance, purchasedBalance: result.purchasedBalance } })
  } catch (error) {
    const result = aiErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

import type { Request, Response } from 'express'
import { configuredAiProvider, aiErrorResponse, runCreditProtected } from '../../server/aiCredits.js'
import { GENERATED_DECK_COST, GENERATED_DECK_SIZE, generateFlashcardDeck, validateGenerationRequest, type FlashcardGenerationRequest } from '../../server/flashcards.js'

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') return void response.status(405).json({ message: 'Method not allowed' })
  try {
    if (JSON.stringify(request.body || {}).length > 16_384) return void response.status(413).json({ error: 'request_too_large', message: 'The deck request is too large.' })
    const body = request.body as FlashcardGenerationRequest & { cardCount?: unknown; cost?: unknown }
    const validated = validateGenerationRequest(body)
    if (!validated || (body.cardCount !== undefined && body.cardCount !== GENERATED_DECK_SIZE) || body.cost !== undefined) return void response.status(400).json({ error: 'invalid_request', message: 'Choose a valid model and deck configuration.' })
    const provider = configuredAiProvider()
    const trustedIp = request.headers['x-vercel-forwarded-for']?.toString().split(',')[0]?.trim() || (process.env.NODE_ENV === 'production' ? undefined : request.ip || request.socket?.remoteAddress)
    const result = await runCreditProtected<{ deck: unknown }>({ authorization: request.headers.authorization, requestId: request.headers['x-request-id'] as string | undefined, feature: 'ai_flashcards', amount: GENERATED_DECK_COST, reservationRpc: 'reserve_flashcard_credits', provider, model: provider === 'azure-openai' ? process.env.AZURE_OPENAI_DEPLOYMENT : process.env.OPENAI_MODEL || 'gpt-5-mini', clientIp: trustedIp }, async ({ client, userId, reservation }) => {
      const generated = await generateFlashcardDeck(body)
      if (!generated.deck) return { value: { deck: null }, source: generated.source, successful: false }
      const deck = { ...generated.deck, source: 'ai' as const, visibility: validated.visibility, owner: true, unlocked: true, unlockCost: 5 }
      const { error } = await client.rpc('stage_generated_flashcard_deck', { p_deck_id: deck.id, p_user_id: userId, p_request_id: request.headers['x-request-id'], p_reservation_id: reservation.reservationId, p_model_id: deck.modelId, p_title: deck.title, p_description: deck.description, p_visibility: validated.visibility, p_content_version: deck.contentVersion, p_cards: deck.cards })
      if (error) throw new Error(`Deck staging failed: ${error.message}`)
      return { value: { deck }, source: generated.source, successful: true }
    })
    response.json({ ...result.value, source: result.source, balance: result.balance })
  } catch (error) {
    const result = aiErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

import type { Request, Response } from 'express'
import { billingErrorResponse, getBillingClient, requireBillingUser, spotflowRequest } from '../../server/billing.js'
import { processSpotflowEvent, safeWebhookPayload, type SpotflowEvent } from '../../server/spotflowWebhook.js'

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'GET') {
    response.status(405).json({ message: 'Method not allowed' })
    return
  }
  try {
    const user = await requireBillingUser(request.headers.authorization)
    const client = getBillingClient()
    const requestedIntent = typeof request.query.intent === 'string' ? request.query.intent : ''
    if (requestedIntent && !/^[0-9a-f-]{36}$/i.test(requestedIntent)) {
      response.status(400).json({ error: 'invalid_intent', message: 'A valid payment intent is required.' })
      return
    }
    let intentQuery = client.from('payment_intents').select('id,provider_reference,product_type,status,credits,created_at,updated_at').eq('user_id', user.id)
    intentQuery = requestedIntent ? intentQuery.eq('id', requestedIntent) : intentQuery.eq('status', 'pending').order('created_at', { ascending: false }).limit(1)
    const { data: intentRows, error } = await intentQuery
    const initialIntent = intentRows?.[0]
    let intent = initialIntent
    if (error) throw error
    if (!intent) {
      response.status(404).json({ error: 'intent_not_found', message: 'Payment intent not found.' })
      return
    }
    if (intent.status === 'pending' && intent.product_type === 'payg_100') {
      const provider = await spotflowRequest(`/payments?reference=${encodeURIComponent(intent.provider_reference)}`)
      const payment = Array.isArray(provider.content) ? provider.content.find((entry) => entry && typeof entry === 'object' && (entry as Record<string, unknown>).reference === intent!.provider_reference) as Record<string, unknown> | undefined : undefined
      if (payment?.status === 'successful') {
        if (payment.amount !== 500 || payment.currency !== 'NGN' || typeof payment.id !== 'string') {
          await client.from('payment_intents').update({ status: 'failed', metadata: { reconciliationError: 'provider_amount_mismatch', providerAmount: payment.amount } }).eq('id', intent.id)
        } else {
          const event: SpotflowEvent = {
            eventId: `reconcile-${payment.id}`,
            eventType: 'payment_successful',
            paymentIntentId: intent.id,
            providerReference: intent.provider_reference,
            providerPaymentId: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            providerUpdatedAt: typeof payment.createdAt === 'string' ? payment.createdAt : new Date().toISOString(),
            metadata: { paymentIntentId: intent.id },
          }
          const { data: claim, error: claimError } = await client.rpc('claim_spotflow_event', { p_event_id: event.eventId, p_event_type: event.eventType, p_payload: safeWebhookPayload(event) })
          if (claimError) throw claimError
          if (claim === 'claimed') await processSpotflowEvent(event)
        }
        const refreshed = await client.from('payment_intents').select('id,provider_reference,product_type,status,credits,created_at,updated_at').eq('id', intent.id).eq('user_id', user.id).single()
        if (refreshed.error) throw refreshed.error
        intent = refreshed.data
      }
    }
    const { data: wallet } = await client.from('credit_wallets').select('free_balance,subscription_balance,purchased_balance').eq('user_id', user.id).single()
    response.json({ intent, wallet })
  } catch (error) {
    const result = billingErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

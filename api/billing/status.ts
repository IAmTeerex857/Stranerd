import type { Request, Response } from 'express'
import { billingErrorResponse, getBillingClient, requireBillingUser, spotflowRequest } from '../../server/billing.js'
import { processSpotflowEvent, safeWebhookPayload, type SpotflowEvent } from '../../server/spotflowWebhook.js'

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'GET') {
    response.status(405).json({ message: 'Method not allowed' })
    return
  }
  try {
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.setHeader('Pragma', 'no-cache')
    const user = await requireBillingUser(request.headers.authorization)
    const client = getBillingClient()
    const requestedIntent = typeof request.query.intent === 'string' ? request.query.intent : ''
    if (requestedIntent && !/^[0-9a-f-]{36}$/i.test(requestedIntent)) {
      response.status(400).json({ error: 'invalid_intent', message: 'A valid payment intent is required.' })
      return
    }
    let intentQuery = client.from('payment_intents').select('id,provider,provider_reference,product_type,status,amount_minor,currency,credits,created_at,updated_at').eq('user_id', user.id)
    intentQuery = requestedIntent ? intentQuery.eq('id', requestedIntent) : intentQuery.eq('status', 'pending').order('created_at', { ascending: false }).limit(1)
    const { data: intentRows, error } = await intentQuery
    const initialIntent = intentRows?.[0]
    let intent = initialIntent
    if (error) throw error
    if (!intent) {
      response.status(404).json({ error: 'intent_not_found', message: 'Payment intent not found.' })
      return
    }
    if (intent.status === 'pending' && intent.provider === 'spotflow') {
      const provider = await spotflowRequest(`/payments?reference=${encodeURIComponent(intent.provider_reference)}`)
      const payment = Array.isArray(provider.content) ? provider.content.find((entry) => entry && typeof entry === 'object' && (entry as Record<string, unknown>).reference === intent!.provider_reference) as Record<string, unknown> | undefined : undefined
      if (payment?.status === 'successful') {
        const providerAmountMinor = typeof payment.amount === 'number' ? payment.amount * 100 : NaN
        if (providerAmountMinor !== intent.amount_minor || payment.currency !== intent.currency || typeof payment.id !== 'string') {
          await client.from('payment_intents').update({ status: 'failed', metadata: { reconciliationError: 'provider_amount_mismatch', providerAmount: payment.amount } }).eq('id', intent.id)
        } else {
          let subscription: Record<string, unknown> | undefined
          if (intent.product_type === 'subscription') {
            const subscriptions = await spotflowRequest('/subscriptions?pageSize=100')
            subscription = Array.isArray(subscriptions.content) ? subscriptions.content.find((entry) => {
              if (!entry || typeof entry !== 'object') return false
              const item = entry as Record<string, unknown>
              const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata as Record<string, unknown> : {}
              return metadata.paymentIntentId === intent!.id && item.status === 'active'
            }) as Record<string, unknown> | undefined : undefined
            if (!subscription) throw new Error('Spotflow has not activated the subscription yet.')
          }
          const event: SpotflowEvent = {
            eventId: `reconcile-${payment.id}`,
            eventType: 'payment_successful',
            paymentIntentId: intent.id,
            providerReference: intent.provider_reference,
            providerPaymentId: payment.id,
            providerSubscriptionId: typeof subscription?.id === 'string' ? subscription.id : undefined,
            providerPlanId: typeof payment.planId === 'string' ? payment.planId : typeof subscription?.planId === 'string' ? subscription.planId : undefined,
            amount: payment.amount as number,
            currency: payment.currency as string,
            periodKey: payment.id,
            periodStart: typeof subscription?.startDate === 'string' ? subscription.startDate : undefined,
            periodEnd: typeof subscription?.nextPaymentDate === 'string' ? subscription.nextPaymentDate : undefined,
            providerUpdatedAt: typeof payment.createdAt === 'string' ? payment.createdAt : undefined,
            metadata: { paymentIntentId: intent.id },
          }
          const { data: claim, error: claimError } = await client.rpc('claim_spotflow_event', { p_event_id: event.eventId, p_event_type: event.eventType, p_payload: safeWebhookPayload(event) })
          if (claimError) throw claimError
          if (claim === 'claimed') await processSpotflowEvent(event)
        }
        const refreshed = await client.from('payment_intents').select('id,provider,provider_reference,product_type,status,amount_minor,currency,credits,created_at,updated_at').eq('id', intent.id).eq('user_id', user.id).single()
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

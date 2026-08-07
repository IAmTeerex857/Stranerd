import type { Request, Response } from 'express'
import { billingErrorResponse, getBillingClient, requireBillingUser, spotflowRequest } from '../../server/billing.js'

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed' })
    return
  }
  try {
    const user = await requireBillingUser(request.headers.authorization)
    const client = getBillingClient()
    const { data: subscription, error } = await client.from('subscriptions').select('id,provider_subscription_id,status,current_period_end').eq('user_id', user.id).in('status', ['active', 'past_due']).maybeSingle()
    if (error) throw error
    if (!subscription) {
      response.status(404).json({ error: 'subscription_not_found', message: 'No cancellable subscription was found.' })
      return
    }
    await spotflowRequest(`/subscriptions/${encodeURIComponent(subscription.provider_subscription_id)}/cancel`, { method: 'POST', body: '{}' })
    const { error: updateError } = await client.from('subscriptions').update({ cancel_at_period_end: true, metadata: { cancellationRequestedAt: new Date().toISOString() } }).eq('id', subscription.id)
    if (updateError) throw updateError
    response.json({ status: 'cancellation_requested', currentPeriodEnd: subscription.current_period_end })
  } catch (error) {
    const result = billingErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

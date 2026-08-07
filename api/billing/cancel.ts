import type { Request, Response } from 'express'
import { billingErrorResponse, checkBillingRateLimit, getBillingClient, requireBillingUser, spotflowRequest } from '../../server/billing.js'

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed' })
    return
  }
  try {
    const user = await requireBillingUser(request.headers.authorization)
    await checkBillingRateLimit(user.id, 'cancel', request, 5, 15)
    const client = getBillingClient()
    const { data: subscription, error } = await client.from('subscriptions').select('id,provider_subscription_id,status,current_period_end,cancel_at_period_end').eq('user_id', user.id).in('status', ['active', 'past_due']).maybeSingle()
    if (error) throw error
    if (!subscription) {
      response.status(404).json({ error: 'subscription_not_found', message: 'No cancellable subscription was found.' })
      return
    }
    if (subscription.cancel_at_period_end) {
      response.json({ status: 'cancellation_requested', currentPeriodEnd: subscription.current_period_end })
      return
    }
    await spotflowRequest(`/subscriptions/${encodeURIComponent(subscription.provider_subscription_id)}/cancel`, { method: 'POST', body: '{}' })
    const { error: updateError } = await client.rpc('mark_spotflow_cancellation_requested', { p_subscription_id: subscription.id, p_user_id: user.id, p_requested_at: new Date().toISOString() })
    if (updateError) throw updateError
    response.json({ status: 'cancellation_requested', currentPeriodEnd: subscription.current_period_end })
  } catch (error) {
    const result = billingErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

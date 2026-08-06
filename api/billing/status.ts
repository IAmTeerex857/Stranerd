import type { Request, Response } from 'express'
import { billingErrorResponse, getBillingClient, requireBillingUser } from '../../server/billing.js'

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'GET') {
    response.status(405).json({ message: 'Method not allowed' })
    return
  }
  try {
    const user = await requireBillingUser(request.headers.authorization)
    const intentId = typeof request.query.intent === 'string' ? request.query.intent : ''
    if (!/^[0-9a-f-]{36}$/i.test(intentId)) {
      response.status(400).json({ error: 'invalid_intent', message: 'A valid payment intent is required.' })
      return
    }
    const client = getBillingClient()
    const { data: intent, error } = await client.from('payment_intents').select('id,product_type,status,credits,created_at,updated_at').eq('id', intentId).eq('user_id', user.id).maybeSingle()
    if (error) throw error
    if (!intent) {
      response.status(404).json({ error: 'intent_not_found', message: 'Payment intent not found.' })
      return
    }
    const { data: wallet } = await client.from('credit_wallets').select('free_balance,subscription_balance,purchased_balance').eq('user_id', user.id).single()
    response.json({ intent, wallet })
  } catch (error) {
    const result = billingErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

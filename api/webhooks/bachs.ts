import type { Request, Response } from 'express'
import { billingErrorResponse, getBillingClient } from '../../server/billing.js'
import { normalizeBachsEvent, processBachsEvent, safeBachsWebhookPayload, verifyBachsSignature } from '../../server/bachsWebhook.js'
import { readRawBody } from '../../server/spotflowWebhook.js'

export const config = { api: { bodyParser: false } }

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed' })
    return
  }
  try {
    const secret = process.env.BACHS_WEBHOOK_SECRET
    if (!secret) {
      response.status(503).json({ error: 'webhook_not_configured', message: 'Bachs webhook verification is not configured.' })
      return
    }
    const rawBody = await readRawBody(request)
    if (rawBody.length === 0 || rawBody.length > 256_000) {
      response.status(413).json({ error: 'invalid_body', message: 'Bachs webhook body is empty or too large.' })
      return
    }
    verifyBachsSignature(rawBody, request.headers, secret)
    let body: Record<string, unknown>
    try {
      body = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>
    } catch {
      response.status(400).json({ error: 'invalid_json', message: 'Bachs webhook body is not valid JSON.' })
      return
    }
    const event = normalizeBachsEvent(body)
    if (process.env.VERCEL_ENV === 'production' && process.env.BACHS_MODE === 'sandbox') {
      response.status(200).json({ received: true, sandbox: true })
      return
    }
    const client = getBillingClient()
    const { data: claim, error: claimError } = await client.rpc('claim_billing_event', { p_provider: 'bachs', p_event_id: event.eventId, p_event_type: event.eventType, p_payload: safeBachsWebhookPayload(event) })
    if (claimError) throw claimError
    if (claim === 'terminal') {
      response.status(200).json({ received: true, duplicate: true })
      return
    }
    if (claim === 'busy') {
      response.status(503).json({ error: 'event_busy', message: 'Bachs event is already being processed.' })
      return
    }
    try {
      const status = await processBachsEvent(event)
      const { error } = await client.rpc('finish_billing_event', { p_provider: 'bachs', p_event_id: event.eventId, p_status: status === 'ignored' ? 'ignored' : 'processed', p_error: null })
      if (error) throw error
      response.status(200).json({ received: true })
    } catch (error) {
      await client.rpc('finish_billing_event', { p_provider: 'bachs', p_event_id: event.eventId, p_status: 'failed', p_error: error instanceof Error ? error.message : 'processing failed' })
      throw error
    }
  } catch (error) {
    const result = billingErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

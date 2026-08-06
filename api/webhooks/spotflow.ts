import type { Request, Response } from 'express'
import { billingErrorResponse, getBillingClient } from '../../server/billing.js'
import { normalizeSpotflowEvent, processSpotflowEvent, readRawBody, safeWebhookPayload, verifySpotflowSignature } from '../../server/spotflowWebhook.js'

export const config = { api: { bodyParser: false } }

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed' })
    return
  }
  try {
    const secret = process.env.SPOTFLOW_WEBHOOK_SECRET
    if (!secret) {
      response.status(503).json({ error: 'webhook_not_configured', message: 'Spotflow webhook verification is not configured.' })
      return
    }
    const rawBody = await readRawBody(request)
    if (rawBody.length === 0 || rawBody.length > 256_000) {
      response.status(413).json({ error: 'invalid_body', message: 'Spotflow webhook body is empty or too large.' })
      return
    }
    const eventId = verifySpotflowSignature(rawBody, request.headers, secret)
    const body = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>
    const event = normalizeSpotflowEvent(body, eventId)
    const client = getBillingClient()
    const { data: claim, error: claimError } = await client.rpc('claim_spotflow_event', { p_event_id: eventId, p_event_type: event.eventType, p_payload: safeWebhookPayload(event) })
    if (claimError) throw claimError
    if (claim === 'terminal') {
      response.status(200).json({ received: true, duplicate: true })
      return
    }
    if (claim === 'busy') {
      response.status(503).json({ error: 'event_busy', message: 'Spotflow event is already being processed.' })
      return
    }
    try {
      const status = await processSpotflowEvent(event)
      if (status === 'ignored') {
        const { error } = await client.rpc('finish_spotflow_event', { p_event_id: eventId, p_status: 'ignored', p_error: null })
        if (error) throw error
      } else {
        const { error } = await client.rpc('finish_spotflow_event', { p_event_id: eventId, p_status: 'processed', p_error: null })
        if (error) throw error
      }
      response.status(200).json({ received: true })
    } catch (error) {
      await client.rpc('finish_spotflow_event', { p_event_id: eventId, p_status: 'failed', p_error: error instanceof Error ? error.message : 'processing failed' })
      throw error
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const signature = request.headers['x-spotflow-signature']?.toString() || ''
      console.warn('Spotflow webhook rejected:', String(error.code), {
        headerNames: Object.keys(request.headers).filter((name) => name.startsWith('webhook-') || name.startsWith('x-spotflow-')),
        signatureShape: signature.replace(/[A-Za-z0-9+/=_-]/g, 'x').slice(0, 120),
        signatureLength: signature.length,
      })
    }
    const result = billingErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'
import { BillingError, getBillingClient } from './billing.js'

type Json = Record<string, unknown>

export type SpotflowEvent = {
  eventId: string
  eventType: string
  paymentIntentId?: string
  providerReference?: string
  providerPaymentId?: string
  providerSubscriptionId?: string
  providerPlanId?: string
  amount?: number
  currency?: string
  periodKey?: string
  periodStart?: string
  periodEnd?: string
  providerUpdatedAt?: string
  metadata: Json
}

function objects(value: unknown, depth = 0): Json[] {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 4) return []
  const object = value as Json
  return [object, ...Object.values(object).flatMap((entry) => objects(entry, depth + 1))]
}

function firstValue<T extends string | number>(body: Json, keys: string[], type: 'string' | 'number'): T | undefined {
  for (const object of objects(body)) {
    for (const key of keys) {
      const value = object[key]
      if (typeof value === type) return value as T
    }
  }
  return undefined
}

function metadataFrom(body: Json) {
  for (const object of objects(body)) {
    if (object.metadata && typeof object.metadata === 'object' && !Array.isArray(object.metadata)) return object.metadata as Json
  }
  return {}
}

function nestedObject(body: Json, keys: string[]) {
  for (const object of objects(body)) {
    for (const key of keys) {
      if (object[key] && typeof object[key] === 'object' && !Array.isArray(object[key])) return object[key] as Json
    }
  }
  return undefined
}

export function normalizeSpotflowEvent(body: Json, eventId: string): SpotflowEvent {
  const metadata = metadataFrom(body)
  const payment = nestedObject(body, ['payment', 'paymentDetails', 'transaction'])
  const subscription = nestedObject(body, ['subscription', 'subscriptionDetails'])
  const eventType = firstValue<string>(body, ['eventType', 'event_type', 'type'], 'string')?.toLowerCase()
  if (!eventType) throw new BillingError(400, 'invalid_event', 'Spotflow event type is missing.')

  const providerPaymentId = payment
    ? firstValue<string>(payment, ['paymentId', 'payment_id', 'id'], 'string')
    : firstValue<string>(body, ['paymentId', 'payment_id'], 'string')
  const providerSubscriptionId = subscription
    ? firstValue<string>(subscription, ['subscriptionId', 'subscription_id', 'id'], 'string')
    : firstValue<string>(body, ['subscriptionId', 'subscription_id'], 'string')
  const providerReference = payment
    ? firstValue<string>(payment, ['reference', 'paymentReference', 'payment_reference'], 'string')
    : firstValue<string>(body, ['reference', 'paymentReference', 'payment_reference'], 'string')
  const periodStart = subscription ? firstValue<string>(subscription, ['currentPeriodStart', 'periodStart', 'current_period_start', 'startDate'], 'string') : undefined
  const periodEnd = subscription ? firstValue<string>(subscription, ['currentPeriodEnd', 'periodEnd', 'current_period_end', 'nextPaymentDate', 'endDate'], 'string') : undefined

  return {
    eventId,
    eventType,
    paymentIntentId: typeof metadata.paymentIntentId === 'string' ? metadata.paymentIntentId : undefined,
    providerReference,
    providerPaymentId,
    providerSubscriptionId,
    providerPlanId: subscription
      ? firstValue<string>(subscription, ['planId', 'plan_id', 'providerPlanId'], 'string')
      : firstValue<string>(body, ['planId', 'plan_id'], 'string'),
    amount: payment ? firstValue<number>(payment, ['amount'], 'number') : firstValue<number>(body, ['amount'], 'number'),
    currency: payment ? firstValue<string>(payment, ['currency'], 'string') : firstValue<string>(body, ['currency'], 'string'),
    periodKey: subscription ? firstValue<string>(subscription, ['periodKey', 'period_key', 'billingCycle', 'cycleReference'], 'string') : undefined,
    periodStart,
    periodEnd,
    providerUpdatedAt: firstValue<string>(body, ['updatedAt', 'eventCreatedAt', 'createdAt', 'timestamp'], 'string'),
    metadata,
  }
}

function secretCandidates(secret: string) {
  const suffix = secret.replace(/^whsec_(?:test_|live_)?/, '')
  const keys = [Buffer.from(secret), Buffer.from(suffix)]
  if (/^[0-9a-f]+$/i.test(suffix) && suffix.length % 2 === 0) keys.push(Buffer.from(suffix, 'hex'))
  else keys.push(Buffer.from(suffix, 'base64'))
  return keys
}

function signatureCandidates(header: string) {
  return header.split(/[ ,]/).flatMap((part) => {
    const value = /^(?:v\d+|sha256)=/i.test(part) ? part.slice(part.indexOf('=') + 1) : part
    if (!value) return []
    const result: Buffer[] = []
    if (/^[0-9a-f]{64}$/i.test(value)) result.push(Buffer.from(value, 'hex'))
    try { result.push(Buffer.from(value, 'base64')) } catch { /* invalid base64 */ }
    return result
  })
}

export function verifySpotflowSignature(rawBody: Buffer, headers: Record<string, string | string[] | undefined>, secret: string, now = Date.now()) {
  const suppliedEventId = Array.isArray(headers['webhook-id']) ? headers['webhook-id'][0] : headers['webhook-id']
  const timestampValue = Array.isArray(headers['webhook-timestamp']) ? headers['webhook-timestamp'][0] : headers['webhook-timestamp']
  const timestamp = timestampValue || (Array.isArray(headers['x-spotflow-timestamp']) ? headers['x-spotflow-timestamp'][0] : headers['x-spotflow-timestamp'])
  const signature = Array.isArray(headers['x-spotflow-signature']) ? headers['x-spotflow-signature'][0] : headers['x-spotflow-signature']
  if (!signature) throw new BillingError(400, 'missing_webhook_headers', 'Spotflow webhook signature is missing.')
  // A timestamp-less signature authenticates only the body, so its idempotency key must also come from the body.
  const eventId = timestamp && suppliedEventId ? suppliedEventId : `body-${createHash('sha256').update(rawBody).digest('hex')}`
  if (timestamp) {
    const timestampMs = /^\d+$/.test(timestamp) ? Number(timestamp) * (timestamp.length <= 10 ? 1000 : 1) : Date.parse(timestamp)
    if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > 5 * 60_000) throw new BillingError(401, 'stale_webhook', 'Spotflow webhook timestamp is invalid or stale.')
  }

  const payloads = timestamp && suppliedEventId
    ? [Buffer.from(`${eventId}.${timestamp}.${rawBody.toString('utf8')}`)]
    : [rawBody]
  const supplied = signatureCandidates(signature)
  const valid = secretCandidates(secret).some((key) => payloads.some((payload) => {
    const expected = createHmac('sha256', key).update(payload).digest()
    return supplied.some((candidate) => candidate.length === expected.length && timingSafeEqual(candidate, expected))
  }))
  if (!valid) throw new BillingError(401, 'invalid_signature', 'Spotflow webhook signature is invalid.')
  return eventId
}

export async function readRawBody(request: Request) {
  if (Buffer.isBuffer(request.body)) return request.body
  if (typeof request.body === 'string') return Buffer.from(request.body)
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  if (chunks.length === 0 && request.body && typeof request.body === 'object') throw new BillingError(500, 'raw_body_unavailable', 'Webhook raw body is unavailable.')
  return Buffer.concat(chunks)
}

function validDate(value?: string) {
  return value && Number.isFinite(Date.parse(value)) ? value : undefined
}

export async function processSpotflowEvent(event: SpotflowEvent) {
  const client = getBillingClient()
  const type = event.eventType
  const intentId = event.paymentIntentId
  const success = ['payment_successful', 'subscription_successful'].includes(type)

  if (/(refund|chargeback|dispute|reversal)/i.test(type)) {
    throw new BillingError(503, 'financial_reversal_requires_review', 'Spotflow reported a financial reversal that requires account reconciliation.')
  }

  if (success) {
    if (!event.providerPaymentId || event.currency !== 'NGN') throw new BillingError(400, 'incomplete_success_event', 'Successful Spotflow event is missing payment identifiers or currency.')
    const { data: existingSubscription, error: subscriptionLookupError } = event.providerSubscriptionId
      ? await client.from('subscriptions').select('id').eq('provider_subscription_id', event.providerSubscriptionId).maybeSingle()
      : { data: null, error: null }
    if (subscriptionLookupError) throw subscriptionLookupError
    const effectiveIntentId = existingSubscription ? undefined : intentId
    const { data: intent, error: intentError } = effectiveIntentId
      ? await client.from('payment_intents').select('product_type,amount_minor,currency,credits').eq('id', effectiveIntentId).maybeSingle()
      : { data: null, error: null }
    if (intentError) throw intentError
    const productType = intent?.product_type || (event.providerSubscriptionId ? 'subscription' : undefined)
    if (!productType) throw new BillingError(404, 'intent_not_found', 'Spotflow payment intent was not found.')

    if (productType === 'payg_100') {
      if (!effectiveIntentId || !event.providerReference || event.amount !== 500) throw new BillingError(400, 'amount_mismatch', 'Spotflow PAYG payment does not match the catalog.')
      const { error } = await client.rpc('apply_spotflow_payg_success', {
        p_event_id: event.eventId,
        p_payment_intent_id: effectiveIntentId,
        p_provider_payment_id: event.providerPaymentId,
        p_provider_reference: event.providerReference,
        p_provider_amount: event.amount * 100,
        p_provider_currency: event.currency,
      })
      if (error) throw error
      return 'processed'
    }

    if (event.amount !== 2500) throw new BillingError(400, 'amount_mismatch', 'Spotflow subscription amount does not match the plan.')
    if (!event.providerSubscriptionId) throw new BillingError(400, 'subscription_id_missing', 'Spotflow subscription ID is missing.')
    if (!process.env.SPOTFLOW_PLUS_PLAN_ID || event.providerPlanId !== process.env.SPOTFLOW_PLUS_PLAN_ID) throw new BillingError(400, 'plan_mismatch', 'Spotflow subscription plan does not match Stranerd Plus.')
    if (effectiveIntentId && !event.providerReference) throw new BillingError(400, 'reference_missing', 'Spotflow payment reference is missing.')
    const periodStart = validDate(event.periodStart)
    const periodEnd = validDate(event.periodEnd)
    const providerUpdatedAt = validDate(event.providerUpdatedAt)
    if (!periodStart || !periodEnd || !providerUpdatedAt) throw new BillingError(400, 'period_missing', 'Spotflow subscription period or event timestamp is missing.')
    const periodKey = event.periodKey || event.providerPaymentId
    const { error } = await client.rpc('apply_spotflow_subscription_success', {
      p_event_id: event.eventId,
      p_payment_intent_id: effectiveIntentId || null,
      p_provider_payment_id: event.providerPaymentId,
      p_provider_reference: event.providerReference || event.providerPaymentId,
      p_provider_subscription_id: event.providerSubscriptionId,
      p_provider_plan_id: event.providerPlanId || process.env.SPOTFLOW_PLUS_PLAN_ID,
      p_provider_amount: event.amount,
      p_provider_currency: event.currency,
      p_period_key: periodKey,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_provider_updated_at: providerUpdatedAt,
    })
    if (error) throw error
    return 'processed'
  }

  if (['payment_failed', 'subscription_failed', 'subscription_payment_failed'].includes(type)) {
    if (!event.providerSubscriptionId) {
      if (intentId) {
        const { error } = await client.from('payment_intents').update({ status: 'failed' }).eq('id', intentId).eq('status', 'pending')
        if (error) throw error
      }
      return 'processed'
    }
    const providerUpdatedAt = validDate(event.providerUpdatedAt)
    if (!providerUpdatedAt) throw new BillingError(400, 'timestamp_missing', 'Spotflow event timestamp is missing.')
    const { error } = await client.rpc('apply_spotflow_subscription_state', { p_event_id: event.eventId, p_provider_subscription_id: event.providerSubscriptionId, p_status: 'past_due', p_provider_updated_at: providerUpdatedAt, p_payment_intent_id: intentId || null })
    if (error) throw error
    return 'processed'
  }

  if (type === 'subscription_cancelled') {
    if (!event.providerSubscriptionId) throw new BillingError(400, 'subscription_id_missing', 'Spotflow subscription ID is missing.')
    const providerUpdatedAt = validDate(event.providerUpdatedAt)
    if (!providerUpdatedAt) throw new BillingError(400, 'timestamp_missing', 'Spotflow event timestamp is missing.')
    const { error } = await client.rpc('apply_spotflow_subscription_state', { p_event_id: event.eventId, p_provider_subscription_id: event.providerSubscriptionId, p_status: 'cancelled', p_provider_updated_at: providerUpdatedAt, p_payment_intent_id: null })
    if (error) throw error
    return 'processed'
  }

  if (type === 'subscription_completed') {
    if (!event.providerSubscriptionId) throw new BillingError(400, 'subscription_id_missing', 'Spotflow subscription ID is missing.')
    const providerUpdatedAt = validDate(event.providerUpdatedAt)
    if (!providerUpdatedAt) throw new BillingError(400, 'timestamp_missing', 'Spotflow event timestamp is missing.')
    const { error } = await client.rpc('apply_spotflow_subscription_state', { p_event_id: event.eventId, p_provider_subscription_id: event.providerSubscriptionId, p_status: 'completed', p_provider_updated_at: providerUpdatedAt, p_payment_intent_id: null })
    if (error) throw error
    return 'processed'
  }

  return 'ignored'
}

export function safeWebhookPayload(event: SpotflowEvent) {
  return {
    eventType: event.eventType,
    paymentIntentId: event.paymentIntentId,
    providerReference: event.providerReference,
    providerPaymentId: event.providerPaymentId,
    providerSubscriptionId: event.providerSubscriptionId,
    providerPlanId: event.providerPlanId,
    amount: event.amount,
    currency: event.currency,
    periodKey: event.periodKey,
    periodStart: event.periodStart,
    periodEnd: event.periodEnd,
    providerUpdatedAt: event.providerUpdatedAt,
  }
}

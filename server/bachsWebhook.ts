import { createHmac, timingSafeEqual } from 'node:crypto'
import { BillingError, bachsRequest, getBillingClient, usdDecimalToMinor } from './billing.js'

type Json = Record<string, unknown>

export type BachsEvent = {
  eventId: string
  eventType: string
  createdAt: string
  data: Json
}

function object(value: unknown): Json | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : undefined
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.length === 0) throw new BillingError(400, 'invalid_event', `Bachs ${field} is missing.`)
  return value
}

function validDate(value: unknown, field: string) {
  const date = requiredString(value, field)
  if (!Number.isFinite(Date.parse(date))) throw new BillingError(400, 'invalid_event', `Bachs ${field} is invalid.`)
  return date
}

export function verifyBachsSignature(rawBody: Buffer, headers: Record<string, string | string[] | undefined>, secret: string, now = Date.now()) {
  const header = (name: string) => {
    const value = headers[name]
    return Array.isArray(value) ? value[0] : value
  }
  const timestampValue = header('x-bachs-timestamp')
  const signature = header('x-bachs-signature')
  if (!timestampValue || !signature) throw new BillingError(400, 'missing_webhook_headers', 'Bachs webhook signature headers are missing.')
  if (!/^\d+$/.test(timestampValue) || !/^[0-9a-f]{64}$/i.test(signature)) throw new BillingError(401, 'invalid_signature', 'Bachs webhook signature is invalid.')
  const timestamp = Number(timestampValue)
  if (!Number.isSafeInteger(timestamp) || Math.abs(now / 1000 - timestamp) > 300) throw new BillingError(401, 'stale_webhook', 'Bachs webhook timestamp is invalid or stale.')
  const expected = createHmac('sha256', secret).update(`${timestampValue}.${rawBody.toString('utf8')}`).digest()
  const supplied = Buffer.from(signature, 'hex')
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new BillingError(401, 'invalid_signature', 'Bachs webhook signature is invalid.')
}

export function normalizeBachsEvent(body: Json): BachsEvent {
  const eventId = requiredString(body.id, 'event ID')
  const eventType = requiredString(body.type, 'event type')
  const createdAt = validDate(body.created_at, 'event timestamp')
  const data = object(body.data)
  if (!data) throw new BillingError(400, 'invalid_event', 'Bachs event data is missing.')
  return { eventId, eventType, createdAt, data }
}

export function isBachsFulfillmentEvent(type: string) {
  return type === 'collection.succeeded' || type === 'invoice.paid'
}

export function safeBachsWebhookPayload(event: BachsEvent) {
  const data = event.data
  const subscription = object(data.subscription)
  return {
    eventType: event.eventType,
    createdAt: event.createdAt,
    reference: data.reference,
    chargeId: data.charge_id,
    invoiceId: data.invoice_id,
    subscriptionId: data.subscription_id || subscription?.subscription_id,
    status: data.status,
    amount: data.amount || data.amount_paid,
    currency: data.currency,
  }
}

function subscriptionFields(data: Json) {
  const product = object(data.product)
  const metadata = object(data.metadata) || {}
  return {
    subscriptionId: typeof data.subscription_id === 'string' ? data.subscription_id : typeof data.id === 'string' ? data.id : undefined,
    productId: typeof data.product_id === 'string' ? data.product_id : typeof product?.id === 'string' ? product.id : undefined,
    status: typeof data.status === 'string' ? data.status : undefined,
    amount: data.amount,
    currency: data.currency,
    periodStart: data.current_period_start,
    periodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end === true,
    paymentIntentId: typeof metadata.paymentIntentId === 'string' ? metadata.paymentIntentId : undefined,
  }
}

async function retrieveSubscription(subscriptionId: string) {
  return subscriptionFields(await bachsRequest(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`))
}

function bachsStatus(value: string | undefined, deleted = false) {
  if (deleted || value === 'canceled') return 'cancelled'
  if (value === 'past_due' || value === 'unpaid' || value === 'paused') return 'past_due'
  if (value === 'active') return 'active'
  return undefined
}

function assertPlus(fields: ReturnType<typeof subscriptionFields>) {
  if (!fields.subscriptionId || fields.productId !== process.env.BACHS_PLUS_PRODUCT_ID || fields.currency !== 'USD' || usdDecimalToMinor(fields.amount) !== 500) {
    throw new BillingError(400, 'subscription_mismatch', 'Bachs subscription does not match Stranerd Plus.')
  }
  validDate(fields.periodStart, 'subscription period start')
  validDate(fields.periodEnd, 'subscription period end')
}

export async function processBachsEvent(event: BachsEvent, requestBachs = bachsRequest) {
  const client = getBillingClient()
  const data = event.data

  if (event.eventType === 'collection.succeeded') {
    const metadata = object(data.metadata) || {}
    if (metadata.productType !== 'payg_100') return 'ignored'
    const intentId = requiredString(metadata.paymentIntentId, 'payment intent metadata')
    const chargeId = requiredString(data.charge_id, 'charge ID')
    const reference = requiredString(data.reference, 'reference')
    const checkoutId = requiredString(data.checkout_id, 'checkout ID')
    const checkout = await requestBachs(`/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`)
    if (!['SUCCEEDED', 'ACCEPTED', 'OVERPAID'].includes(String(data.status))
      || String(checkout.status).toLowerCase() !== 'completed'
      || checkout.reference !== reference
      || checkout.currency !== 'USD'
      || usdDecimalToMinor(checkout.amount) !== 200) {
      throw new BillingError(400, 'amount_mismatch', 'Bachs PAYG collection does not match the catalog.')
    }
    const { error } = await client.rpc('apply_bachs_payg_success', {
      p_event_id: event.eventId,
      p_payment_intent_id: intentId,
      p_provider_payment_id: chargeId,
      p_provider_reference: reference,
      p_provider_amount_minor: 200,
      p_provider_currency: 'USD',
    })
    if (error) throw error
    return 'processed'
  }

  if (event.eventType === 'checkout.expired') {
    const metadata = object(data.metadata) || {}
    const intentId = requiredString(metadata.paymentIntentId, 'payment intent metadata')
    const reference = requiredString(data.reference, 'reference')
    const { error } = await client.from('payment_intents').update({ status: 'cancelled' })
      .eq('id', intentId).eq('provider', 'bachs').eq('provider_reference', reference).eq('status', 'pending')
    if (error) throw error
    return 'processed'
  }

  if (event.eventType === 'collection.failed' || event.eventType === 'collection.underpaid') {
    const metadata = object(data.metadata) || {}
    const intentId = requiredString(metadata.paymentIntentId, 'payment intent metadata')
    const reference = requiredString(data.reference, 'reference')
    const { error } = await client.from('payment_intents').update({ status: 'failed' })
      .eq('id', intentId).eq('provider', 'bachs').eq('provider_reference', reference).eq('status', 'pending')
    if (error) throw error
    return 'processed'
  }

  if (event.eventType === 'invoice.paid') {
    const invoiceId = requiredString(data.invoice_id, 'invoice ID')
    const embeddedSubscription = object(data.subscription)
    const subscriptionId = requiredString(embeddedSubscription?.subscription_id, 'subscription ID')
    let fields = subscriptionFields(data)
    const local = await client.from('subscriptions').select('user_id').eq('provider', 'bachs').eq('provider_subscription_id', subscriptionId).maybeSingle()
    if (local.error) throw local.error
    fields = { ...fields, ...await retrieveSubscription(subscriptionId) }
    assertPlus({ ...fields, subscriptionId })
    if (data.status !== 'paid' || data.currency !== 'USD' || usdDecimalToMinor(data.amount_paid) !== 500 || usdDecimalToMinor(data.amount_remaining) !== 0) {
      throw new BillingError(400, 'amount_mismatch', 'Bachs invoice does not match the subscription catalog.')
    }
    const { error } = await client.rpc('apply_bachs_subscription_cycle', {
      p_event_id: event.eventId,
      p_payment_intent_id: local.data?.user_id ? null : fields.paymentIntentId || null,
      p_provider_payment_id: invoiceId,
      p_provider_subscription_id: subscriptionId,
      p_provider_plan_id: fields.productId,
      p_provider_amount_minor: 500,
      p_provider_currency: 'USD',
      p_period_key: invoiceId,
      p_period_start: validDate(data.period_start, 'invoice period start'),
      p_period_end: validDate(data.period_end, 'invoice period end'),
      p_provider_updated_at: event.createdAt,
    })
    if (error) throw error
    return 'processed'
  }

  if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.eventType)) {
    let fields = subscriptionFields(data)
    if (!fields.paymentIntentId && event.eventType === 'customer.subscription.created') fields = { ...fields, ...await retrieveSubscription(requiredString(fields.subscriptionId, 'subscription ID')) }
    assertPlus(fields)
    const status = bachsStatus(fields.status, event.eventType === 'customer.subscription.deleted')
    if (!status) return 'ignored'
    const { error } = await client.rpc('apply_bachs_subscription_state', {
      p_event_id: event.eventId,
      p_payment_intent_id: fields.paymentIntentId || null,
      p_provider_subscription_id: fields.subscriptionId,
      p_provider_plan_id: fields.productId,
      p_status: status,
      p_period_start: validDate(fields.periodStart, 'subscription period start'),
      p_period_end: validDate(fields.periodEnd, 'subscription period end'),
      p_cancel_at_period_end: fields.cancelAtPeriodEnd || event.eventType === 'customer.subscription.deleted',
      p_provider_updated_at: event.createdAt,
    })
    if (error) throw error
    return 'processed'
  }

  return 'ignored'
}

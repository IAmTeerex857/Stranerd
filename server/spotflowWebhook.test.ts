import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { normalizeSpotflowEvent, safeWebhookPayload, verifySpotflowSignature } from './spotflowWebhook.js'

describe('Spotflow webhooks', () => {
  it('verifies a fresh standard webhook signature', () => {
    const body = Buffer.from('{"eventType":"payment_successful"}')
    const eventId = 'event-1'
    const timestamp = String(Math.floor(Date.now() / 1000))
    const secret = `whsec_test_${'01'.repeat(16)}`
    const key = Buffer.from('01'.repeat(16), 'hex')
    const signature = createHmac('sha256', key).update(`${eventId}.${timestamp}.${body.toString()}`).digest('base64')
    expect(verifySpotflowSignature(body, { 'webhook-id': eventId, 'webhook-timestamp': timestamp, 'x-spotflow-signature': `v1,${signature}` }, secret)).toBe(eventId)
  })

  it('rejects stale webhook signatures', () => {
    const timestamp = String(Math.floor((Date.now() - 10 * 60_000) / 1000))
    expect(() => verifySpotflowSignature(Buffer.from('{}'), { 'webhook-id': 'event-1', 'webhook-timestamp': timestamp, 'x-spotflow-signature': 'bad' }, 'secret')).toThrow(/timestamp/i)
  })

  it('verifies Spotflow raw-body HMAC when no timestamp header is sent', () => {
    const body = Buffer.from('{"eventType":"payment_successful"}')
    const eventId = 'event-raw-1'
    const secret = `whsec_test_${'02'.repeat(16)}`
    const signature = createHmac('sha256', Buffer.from('02'.repeat(16), 'hex')).update(body).digest('hex')
    expect(verifySpotflowSignature(body, { 'webhook-id': eventId, 'x-spotflow-signature': signature }, secret)).toMatch(/^body-[0-9a-f]{64}$/)
  })

  it('ignores an unsigned event ID for timestamp-less signatures', () => {
    const body = Buffer.from('{"eventType":"payment_successful"}')
    const secret = `whsec_test_${'04'.repeat(16)}`
    const signature = createHmac('sha256', Buffer.from('04'.repeat(16), 'hex')).update(body).digest('hex')
    const first = verifySpotflowSignature(body, { 'webhook-id': 'first', 'x-spotflow-signature': signature }, secret)
    const replay = verifySpotflowSignature(body, { 'webhook-id': 'changed', 'x-spotflow-signature': signature }, secret)
    expect(replay).toBe(first)
  })

  it('derives a deterministic event ID when Spotflow omits webhook-id', () => {
    const body = Buffer.from('{"eventType":"payment_successful","id":"payment-1"}')
    const secret = `whsec_test_${'03'.repeat(16)}`
    const signature = createHmac('sha256', Buffer.from('03'.repeat(16), 'hex')).update(body).digest('base64')
    expect(verifySpotflowSignature(body, { 'x-spotflow-signature': signature }, secret)).toMatch(/^body-[0-9a-f]{64}$/)
  })

  it('normalizes allowlisted payment and subscription fields', () => {
    const event = normalizeSpotflowEvent({
      eventType: 'subscription_successful',
      data: {
        payment: { id: 'pay-1', reference: 'ref-1', amount: 2500, currency: 'NGN' },
        subscription: { id: 'sub-1', planId: 'plan-1', currentPeriodStart: '2026-08-01T00:00:00Z', currentPeriodEnd: '2026-09-01T00:00:00Z' },
        metadata: { paymentIntentId: '123e4567-e89b-42d3-a456-426614174000', email: 'do-not-store@example.com' },
      },
    }, 'event-1')
    expect(event).toMatchObject({ eventType: 'subscription_successful', providerPaymentId: 'pay-1', providerReference: 'ref-1', providerSubscriptionId: 'sub-1', providerPlanId: 'plan-1', amount: 2500, currency: 'NGN' })
    expect(JSON.stringify(safeWebhookPayload(event))).not.toContain('do-not-store')
  })
})

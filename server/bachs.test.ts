import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { bachsConfiguration, bachsRequest, buildBachsCheckoutPayload, setBillingClientForTests, usdDecimalToMinor, validateBachsCheckoutUrl } from './billing.js'
import { isBachsFulfillmentEvent, normalizeBachsEvent, processBachsEvent, verifyBachsSignature } from './bachsWebhook.js'

const originalMode = process.env.BACHS_MODE
const originalKey = process.env.BACHS_API_KEY
const originalVercelEnvironment = process.env.VERCEL_ENV

afterEach(() => {
  process.env.BACHS_MODE = originalMode
  process.env.BACHS_API_KEY = originalKey
  process.env.VERCEL_ENV = originalVercelEnvironment
  setBillingClientForTests()
  vi.unstubAllGlobals()
})

describe('Bachs configuration and checkout', () => {
  it.each([
    ['sandbox', 'sk_sandbox_example', 'https://sandbox-api.bachs.io'],
    ['live', 'sk_live_example', 'https://api.bachs.io'],
  ])('selects only the matching %s environment', (mode, key, baseUrl) => {
    process.env.BACHS_MODE = mode
    process.env.BACHS_API_KEY = key
    expect(bachsConfiguration()).toMatchObject({ mode, key, baseUrl })
  })

  it('rejects mismatched and unsupported mode/key combinations', () => {
    process.env.BACHS_MODE = 'live'
    process.env.BACHS_API_KEY = 'sk_sandbox_example'
    expect(() => bachsConfiguration()).toThrow(/does not match/i)
    process.env.BACHS_MODE = 'test'
    process.env.BACHS_API_KEY = 'sk_test_example'
    expect(() => bachsConfiguration()).toThrow(/does not match/i)
  })

  it('never permits sandbox credentials in Vercel production', () => {
    process.env.VERCEL_ENV = 'production'
    process.env.BACHS_MODE = 'sandbox'
    process.env.BACHS_API_KEY = 'sk_sandbox_example'
    expect(() => bachsConfiguration()).toThrow(/live credentials/i)
  })

  it('formats a card subscription checkout with catalog product pricing', () => {
    expect(buildBachsCheckoutPayload({ productId: 'subscription', rail: 'usd_card', paymentIntentId: 'intent-1', reference: 'intent-1', userId: 'user-1', email: 'a@example.com', name: 'A User', plusProductId: 'prod_plus', baseUrl: 'https://app.example.com' })).toEqual({
      customer: { email: 'a@example.com', name: 'A User' },
      product_cart: [{ product_id: 'prod_plus', quantity: 1 }],
      billing_currency: 'USD',
      allowed_payment_method_types: ['card'],
      reference: 'intent-1',
      metadata: { paymentIntentId: 'intent-1', userId: 'user-1', productType: 'subscription' },
      success_url: 'https://app.example.com/billing/success?intent=intent-1',
      cancel_url: 'https://app.example.com/billing/cancelled',
    })
  })

  it('formats raw PAYG USD pricing and crypto rail', () => {
    const payload = buildBachsCheckoutPayload({ productId: 'payg_100', rail: 'stablecoin', paymentIntentId: 'intent-2', reference: 'intent-2', userId: 'user-1', email: 'a@example.com', name: 'A User', baseUrl: 'https://app.example.com' })
    expect(payload).toMatchObject({ pricing: { currency: 'USD', amount: '2.00', price_type: 'fixed' }, allowed_payment_method_types: ['crypto'] })
    expect(() => buildBachsCheckoutPayload({ productId: 'subscription', rail: 'stablecoin', paymentIntentId: 'i', reference: 'i', userId: 'u', email: 'a@example.com', name: 'A', plusProductId: 'prod_plus', baseUrl: 'https://app.example.com' })).toThrow(/card/i)
  })

  it('sends Bachs authorization and idempotency headers to the selected host', async () => {
    process.env.BACHS_MODE = 'sandbox'
    process.env.BACHS_API_KEY = 'sk_sandbox_example'
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ checkout_url: 'https://checkout.bachs.io/c/1' }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    await bachsRequest('/v1/checkout-sessions', { method: 'POST', headers: { 'Idempotency-Key': 'bachs:intent-1' }, body: '{}' })
    expect(fetchMock).toHaveBeenCalledWith('https://sandbox-api.bachs.io/v1/checkout-sessions', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer sk_sandbox_example', 'Idempotency-Key': 'bachs:intent-1' }) }))
  })

  it('accepts only strict two-decimal USD and secure Bachs URLs', () => {
    expect(usdDecimalToMinor('2.00')).toBe(200)
    for (const value of [2, '2', '2.0', '02.00', '2.000', '-2.00', '2e0']) expect(() => usdDecimalToMinor(value)).toThrow(/invalid USD amount/i)
    expect(validateBachsCheckoutUrl('https://checkout.bachs.io/c/chk_1')).toContain('bachs.io')
    expect(() => validateBachsCheckoutUrl('not a URL')).toThrow(/invalid checkout URL/i)
    expect(() => validateBachsCheckoutUrl('http://checkout.bachs.io/c/1')).toThrow(/invalid checkout URL/i)
    expect(() => validateBachsCheckoutUrl('https://bachs.io.evil.example/c/1')).toThrow(/invalid checkout URL/i)
  })
})

describe('Bachs webhooks', () => {
  it('verifies a fresh raw-body signature', () => {
    const body = Buffer.from('{"id":"evt_1"}')
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = createHmac('sha256', 'whsec_example').update(`${timestamp}.${body.toString()}`).digest('hex')
    expect(() => verifyBachsSignature(body, { 'x-bachs-timestamp': timestamp, 'x-bachs-signature': signature }, 'whsec_example')).not.toThrow()
  })

  it('rejects malformed, incorrect, and stale signatures', () => {
    const body = Buffer.from('{}')
    const timestamp = String(Math.floor(Date.now() / 1000))
    expect(() => verifyBachsSignature(body, {}, 'secret')).toThrow(/missing/i)
    expect(() => verifyBachsSignature(body, { 'x-bachs-timestamp': timestamp, 'x-bachs-signature': 'not-hex' }, 'secret')).toThrow(/invalid/i)
    expect(() => verifyBachsSignature(body, { 'x-bachs-timestamp': timestamp, 'x-bachs-signature': '00'.repeat(32) }, 'secret')).toThrow(/invalid/i)
    const stale = String(Number(timestamp) - 301)
    expect(() => verifyBachsSignature(body, { 'x-bachs-timestamp': stale, 'x-bachs-signature': '00'.repeat(32) }, 'secret')).toThrow(/stale/i)
  })

  it('normalizes only the documented event envelope', () => {
    expect(normalizeBachsEvent({ id: 'evt_1', type: 'collection.succeeded', created_at: '2026-08-11T12:00:00Z', data: { charge_id: 'chr_1' } })).toEqual({ eventId: 'evt_1', eventType: 'collection.succeeded', createdAt: '2026-08-11T12:00:00Z', data: { charge_id: 'chr_1' } })
    expect(() => normalizeBachsEvent({ id: 'evt_1', type: 'collection.succeeded', data: {} })).toThrow(/timestamp/i)
  })

  it('checks PAYG amount and currency before invoking allocation', async () => {
    const rpc = vi.fn(async () => ({ error: null }))
    setBillingClientForTests({ rpc } as never)
    const base = { eventId: 'evt_1', eventType: 'collection.succeeded', createdAt: '2026-08-11T12:00:00Z', data: { charge_id: 'chr_1', checkout_id: 'chk_1', reference: 'intent-1', status: 'SUCCEEDED', amount: '2.00', currency: 'USD', metadata: { paymentIntentId: 'intent-1', productType: 'payg_100' } } }
    const validCheckout = async () => ({ status: 'completed', reference: 'intent-1', currency: 'USD', amount: '2.00' })
    await expect(processBachsEvent(base, validCheckout)).resolves.toBe('processed')
    expect(rpc).toHaveBeenCalledWith('apply_bachs_payg_success', expect.objectContaining({ p_provider_amount_minor: 200, p_provider_currency: 'USD' }))
    await expect(processBachsEvent(base, async () => ({ status: 'completed', reference: 'intent-1', currency: 'USD', amount: '2.01' }))).rejects.toThrow(/catalog/i)
    await expect(processBachsEvent(base, async () => ({ status: 'completed', reference: 'other', currency: 'USD', amount: '2.00' }))).rejects.toThrow(/catalog/i)
  })

  it('accepts a stablecoin collection after verifying its USD checkout', async () => {
    const rpc = vi.fn(async () => ({ error: null }))
    setBillingClientForTests({ rpc } as never)
    const event = { eventId: 'evt_crypto', eventType: 'collection.succeeded', createdAt: '2026-08-11T12:00:00Z', data: { charge_id: 'chr_crypto', checkout_id: 'chk_crypto', reference: 'intent-crypto', status: 'ACCEPTED', amount: '2.00', currency: 'USDT_TRC20', metadata: { paymentIntentId: 'intent-crypto', productType: 'payg_100' } } }
    await expect(processBachsEvent(event, async () => ({ status: 'COMPLETED', reference: 'intent-crypto', currency: 'USD', amount: '2.00' }))).resolves.toBe('processed')
  })

  it('never treats checkout redirects or completion events as fulfillment', () => {
    expect(isBachsFulfillmentEvent('checkout.completed')).toBe(false)
    expect(isBachsFulfillmentEvent('collection.succeeded')).toBe(true)
    expect(isBachsFulfillmentEvent('invoice.paid')).toBe(true)
  })

  it('ignores subscription collections because invoice.paid owns cycle fulfillment', async () => {
    const rpc = vi.fn()
    setBillingClientForTests({ rpc } as never)
    await expect(processBachsEvent({ eventId: 'evt_subscription_charge', eventType: 'collection.succeeded', createdAt: '2026-08-11T12:00:00Z', data: { metadata: { productType: 'subscription' } } })).resolves.toBe('ignored')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('cancels only the matching pending intent when checkout expires', async () => {
    const eq = vi.fn().mockReturnThis()
    const update = vi.fn(() => ({ eq }))
    setBillingClientForTests({ from: vi.fn(() => ({ update })) } as never)
    await expect(processBachsEvent({ eventId: 'evt_expired', eventType: 'checkout.expired', createdAt: '2026-08-11T12:00:00Z', data: { reference: 'intent-1', metadata: { paymentIntentId: 'intent-1' } } })).resolves.toBe('processed')
    expect(update).toHaveBeenCalledWith({ status: 'cancelled' })
    expect(eq).toHaveBeenCalledWith('provider_reference', 'intent-1')
    expect(eq).toHaveBeenCalledWith('status', 'pending')
  })

  it.each(['collection.failed', 'collection.underpaid'])('fails only the matching pending intent for %s', async (eventType) => {
    const eq = vi.fn().mockReturnThis()
    const update = vi.fn(() => ({ eq }))
    setBillingClientForTests({ from: vi.fn(() => ({ update })) } as never)
    await expect(processBachsEvent({ eventId: `evt_${eventType}`, eventType, createdAt: '2026-08-11T12:00:00Z', data: { reference: 'intent-1', metadata: { paymentIntentId: 'intent-1' } } })).resolves.toBe('processed')
    expect(update).toHaveBeenCalledWith({ status: 'failed' })
    expect(eq).toHaveBeenCalledWith('provider_reference', 'intent-1')
  })
})

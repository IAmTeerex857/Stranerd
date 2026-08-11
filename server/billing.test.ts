import { afterEach, describe, expect, it, vi } from 'vitest'
import { billingCountry, billingRails, BillingError, spotflowRequest } from './billing.js'

const originalSecret = process.env.SPOTFLOW_SECRET_KEY
const originalMode = process.env.SPOTFLOW_MODE

afterEach(() => {
  process.env.SPOTFLOW_SECRET_KEY = originalSecret
  process.env.SPOTFLOW_MODE = originalMode
  vi.unstubAllGlobals()
})

describe('Spotflow mode validation', () => {
  it.each([
    ['test', 'sk_test_example'],
    ['live', 'sk_live_example'],
  ])('accepts a matching %s key', async (mode, secret) => {
    process.env.SPOTFLOW_MODE = mode
    process.env.SPOTFLOW_SECRET_KEY = secret
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(spotflowRequest('/payments/example')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/payments/example'), expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${secret}` }) }))
  })

  it('rejects a key whose prefix does not match the selected mode', async () => {
    process.env.SPOTFLOW_MODE = 'live'
    process.env.SPOTFLOW_SECRET_KEY = 'sk_test_example'
    await expect(spotflowRequest('/payments/example')).rejects.toMatchObject({ code: 'spotflow_mode_mismatch', status: 503 } satisfies Partial<BillingError>)
  })
})

describe('regional billing rails', () => {
  it('offers Nigeria NGN subscriptions and NGN or stablecoin packs', () => {
    expect(billingRails('NG', 'subscription')).toEqual(['ngn'])
    expect(billingRails('NG', 'payg_100')).toEqual(['ngn', 'stablecoin'])
  })

  it('offers international USD-card subscriptions and card or stablecoin packs', () => {
    expect(billingRails('US', 'subscription')).toEqual(['usd_card'])
    expect(billingRails('GB', 'payg_100')).toEqual(['usd_card', 'stablecoin'])
  })

  it('accepts only a valid trusted country header', () => {
    expect(billingCountry({ 'x-vercel-ip-country': 'ng' })).toBe('NG')
    expect(billingCountry({ 'x-vercel-ip-country': ['US'] })).toBe('US')
    expect(billingCountry({ 'x-vercel-ip-country': 'Nigeria' })).toBe('UNKNOWN')
  })
})

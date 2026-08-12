import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export type BillingProductId = 'subscription' | 'payg_100'
export type BillingRail = 'ngn' | 'usd_card' | 'stablecoin'

export function billingCountry(headers: Record<string, string | string[] | undefined>) {
  const supplied = headers['x-vercel-ip-country']
  const value = Array.isArray(supplied) ? supplied[0] : supplied
  return typeof value === 'string' && /^[A-Z]{2}$/i.test(value) ? value.toUpperCase() : 'UNKNOWN'
}

export function billingRails(country: string, productId: BillingProductId): BillingRail[] {
  if (country === 'NG') return productId === 'subscription' ? ['ngn'] : ['ngn', 'stablecoin']
  return productId === 'subscription' ? ['usd_card'] : ['usd_card', 'stablecoin']
}

export const billingCatalog = {
  subscription: { productType: 'subscription', amountMinor: 250000, providerAmount: undefined, currency: 'NGN', credits: 500 },
  payg_100: { productType: 'payg_100', amountMinor: 50000, providerAmount: 500, currency: 'NGN', credits: 100 },
} as const

export const bachsCatalog = {
  subscription: { productType: 'subscription', amountMinor: 500, amount: '5.00', currency: 'USD', credits: 500 },
  payg_100: { productType: 'payg_100', amountMinor: 200, amount: '2.00', currency: 'USD', credits: 100 },
} as const

export class BillingError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

let serviceClient: SupabaseClient | undefined

export function getBillingClient() {
  if (serviceClient) return serviceClient
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new BillingError(503, 'server_not_configured', 'Billing account services are not configured.')
  serviceClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return serviceClient
}

export function setBillingClientForTests(client?: SupabaseClient) {
  serviceClient = client
}

export async function requireBillingUser(authorization?: string): Promise<User> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) throw new BillingError(401, 'authentication_required', 'Sign in to manage billing.')
  const { data, error } = await getBillingClient().auth.getUser(token)
  if (error || !data.user) throw new BillingError(401, 'invalid_session', 'Your session is invalid or expired.')
  return data.user
}

function spotflowSecret() {
  const secret = process.env.SPOTFLOW_SECRET_KEY
  const mode = process.env.SPOTFLOW_MODE
  if (!secret || !mode) throw new BillingError(503, 'spotflow_not_configured', 'Spotflow billing is not configured.')
  if (!['test', 'live'].includes(mode) || !secret.startsWith(`sk_${mode}_`)) throw new BillingError(503, 'spotflow_mode_mismatch', 'Spotflow billing mode does not match its secret key.')
  return secret
}

export async function spotflowRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.spotflow.co/api/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${spotflowSecret()}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    signal: AbortSignal.timeout(20_000),
  })
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) throw new BillingError(502, 'spotflow_request_failed', typeof body.message === 'string' ? body.message : 'Spotflow could not complete the request.')
  return body
}

export function bachsConfiguration() {
  const mode = process.env.BACHS_MODE
  const key = process.env.BACHS_API_KEY
  if (!mode || !key) throw new BillingError(503, 'bachs_not_configured', 'Bachs billing is not configured.')
  if (process.env.VERCEL_ENV === 'production' && mode !== 'live') {
    throw new BillingError(503, 'bachs_live_required', 'Production Bachs billing requires live credentials.')
  }
  if (!['sandbox', 'live'].includes(mode) || !key.startsWith(`sk_${mode}_`)) {
    throw new BillingError(503, 'bachs_mode_mismatch', 'Bachs billing mode does not match its API key.')
  }
  return { key, mode, baseUrl: mode === 'sandbox' ? 'https://sandbox-api.bachs.io' : 'https://api.bachs.io' }
}

export async function bachsRequest(path: string, init: RequestInit = {}) {
  const { key, baseUrl } = bachsConfiguration()
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    signal: AbortSignal.timeout(20_000),
  })
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) throw new BillingError(502, 'bachs_request_failed', typeof body.detail === 'string' ? body.detail : 'Bachs could not complete the request.')
  return body
}

export function usdDecimalToMinor(value: unknown) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.\d{2}$/.test(value)) {
    throw new BillingError(400, 'invalid_money', 'Bachs returned an invalid USD amount.')
  }
  const [whole, fraction] = value.split('.')
  const minor = Number(whole) * 100 + Number(fraction)
  if (!Number.isSafeInteger(minor)) throw new BillingError(400, 'invalid_money', 'Bachs returned an invalid USD amount.')
  return minor
}

export function validateBachsCheckoutUrl(value: unknown) {
  if (typeof value !== 'string') throw new BillingError(502, 'invalid_checkout_url', 'Bachs returned an invalid checkout URL.')
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new BillingError(502, 'invalid_checkout_url', 'Bachs returned an invalid checkout URL.')
  }
  if (url.protocol !== 'https:' || !/(^|\.)bachs\.io$/i.test(url.hostname)) {
    throw new BillingError(502, 'invalid_checkout_url', 'Bachs returned an invalid checkout URL.')
  }
  return value
}

export function buildBachsCheckoutPayload(options: {
  productId: BillingProductId
  rail: Exclude<BillingRail, 'ngn'>
  paymentIntentId: string
  reference: string
  userId: string
  email: string
  name: string
  plusProductId?: string
  baseUrl: string
}) {
  const product = bachsCatalog[options.productId]
  if (options.productId === 'subscription' && options.rail === 'stablecoin') throw new BillingError(400, 'invalid_rail', 'Subscriptions require USD card checkout.')
  if (options.productId === 'subscription' && !options.plusProductId) throw new BillingError(503, 'plan_not_configured', 'The Bachs Stranerd Plus product is not configured.')
  return {
    customer: { email: options.email, name: options.name },
    ...(options.productId === 'subscription'
      ? { product_cart: [{ product_id: options.plusProductId, quantity: 1 }] }
      : { pricing: { currency: 'USD', amount: product.amount, price_type: 'fixed' } }),
    billing_currency: 'USD',
    allowed_payment_method_types: options.productId === 'payg_100' ? ['card', 'crypto'] : ['card'],
    reference: options.reference,
    metadata: { paymentIntentId: options.paymentIntentId, userId: options.userId, productType: product.productType },
    success_url: `${options.baseUrl}/billing/success?intent=${options.paymentIntentId}`,
    cancel_url: `${options.baseUrl}/billing/cancelled`,
  }
}

export function billingErrorResponse(error: unknown) {
  if (error instanceof BillingError) return { status: error.status, body: { error: error.code, message: error.message } }
  console.error('Billing request failed:', error instanceof Error ? error.message : error)
  return { status: 500, body: { error: 'internal_error', message: 'The billing request could not be completed.' } }
}

export function appBaseUrl() {
  const value = process.env.APP_BASE_URL || 'http://localhost:5173'
  const url = new URL(value)
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') throw new BillingError(503, 'invalid_app_url', 'Production billing requires a secure application URL.')
  return url.toString().replace(/\/$/, '')
}

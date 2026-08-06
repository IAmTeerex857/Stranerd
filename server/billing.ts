import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export type BillingProductId = 'subscription' | 'payg_100'

export const billingCatalog = {
  subscription: { productType: 'subscription', amountMinor: 250000, providerAmount: undefined, currency: 'NGN', credits: 500 },
  payg_100: { productType: 'payg_100', amountMinor: 50000, providerAmount: 500, currency: 'NGN', credits: 100 },
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
  if (!secret) throw new BillingError(503, 'spotflow_not_configured', 'Spotflow test billing is not configured.')
  if ((process.env.SPOTFLOW_MODE || 'test') !== 'test' || !secret.startsWith('sk_test_')) throw new BillingError(503, 'live_billing_disabled', 'Only Spotflow test mode is enabled during integration.')
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

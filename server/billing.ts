import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import type { Request } from 'express'

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

export async function checkBillingRateLimit(userId: string, action: string, request: Request, userLimit: number, ipLimit: number) {
  const forwarded = process.env.VERCEL === '1' ? request.headers['x-vercel-forwarded-for']?.toString().split(',')[0]?.trim() : undefined
  const address = forwarded || (process.env.VERCEL === '1' ? undefined : request.ip || request.socket?.remoteAddress)
  const ipHash = address ? createHmac('sha256', process.env.RATE_LIMIT_HASH_SECRET || process.env.SUPABASE_SECRET_KEY!).update(address).digest('hex') : null
  const { data, error } = await getBillingClient().rpc('check_ai_rate_limits', {
    p_user_key: `billing:${action}:user:${userId}`,
    p_user_limit: userLimit,
    p_ip_key: ipHash ? `billing:${action}:ip:${ipHash}` : null,
    p_ip_limit: ipLimit,
    p_window_seconds: 60,
  })
  if (error) throw new BillingError(503, 'rate_limit_unavailable', 'Billing request limits could not be verified.')
  if (!data) throw new BillingError(429, 'rate_limited', 'Too many billing requests. Please wait and try again.')
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

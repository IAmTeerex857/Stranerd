import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

export type BillingProductId = 'subscription' | 'payg_100'
export type BillingRail = 'ngn' | 'usd_card' | 'stablecoin'
export type BillingOptions = { country: string; rails: Record<BillingProductId, BillingRail[]>; unavailable?: boolean }

let billingOptions: BillingOptions | undefined
let billingOptionsRequest: Promise<void> | undefined
const billingOptionsListeners = new Set<() => void>()

function loadBillingOptions() {
  if (billingOptionsRequest) return
  billingOptionsRequest = fetch('/api/billing/checkout', { cache: 'no-store' })
    .then(async (response) => {
      const body = await response.json() as BillingOptions
      if (!response.ok || !body.rails) throw new Error('Payment options could not be loaded.')
      billingOptions = body
    })
    .catch(() => {
      billingOptions = { country: 'UNKNOWN', rails: { subscription: [], payg_100: [] }, unavailable: true }
    })
    .finally(() => billingOptionsListeners.forEach((listener) => listener()))
}

function subscribeBillingOptions(listener: () => void) {
  billingOptionsListeners.add(listener)
  loadBillingOptions()
  return () => billingOptionsListeners.delete(listener)
}

export function useBillingOptions() {
  return useSyncExternalStore(subscribeBillingOptions, () => billingOptions, () => undefined)
}

export function checkoutRail(options: BillingOptions | undefined, productId: BillingProductId) {
  if (!options) return undefined
  const rails = options.rails[productId]
  if (options.country === 'NG') return rails.find((rail) => rail === 'ngn')
  return rails.find((rail) => rail === 'usd_card') || rails.find((rail) => rail !== 'ngn')
}

async function billingFetch(path: string, init: RequestInit = {}) {
  if (!supabase) throw new Error('Sign in to manage billing.')
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Sign in to manage billing.')
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}`, ...init.headers },
  })
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) throw new Error(typeof body.message === 'string' ? body.message : 'Billing request failed.')
  return body
}

export async function startCheckout(productId: BillingProductId, rail: BillingRail, quantity = 1) {
  const body = await billingFetch('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ productId, rail, quantity }) })
  if (typeof body.checkoutUrl !== 'string' || typeof body.paymentIntentId !== 'string') throw new Error('Checkout details were not returned.')
  window.localStorage.setItem('stranerd.billing.pendingIntent', body.paymentIntentId)
  window.location.assign(body.checkoutUrl)
}

export async function getBillingStatus(intentId?: string) {
  return billingFetch(`/api/billing/status${intentId ? `?intent=${encodeURIComponent(intentId)}` : ''}`) as Promise<{
    intent: { id: string; product_type: BillingProductId; status: string; credits: number }
    wallet?: { free_balance: number; subscription_balance: number; purchased_balance: number }
  }>
}

export async function cancelSubscription() {
  return billingFetch('/api/billing/cancel', { method: 'POST', body: '{}' })
}

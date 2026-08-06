import { supabase } from './supabase'

export type BillingProductId = 'subscription' | 'payg_100'

async function billingFetch(path: string, init: RequestInit = {}) {
  if (!supabase) throw new Error('Sign in to manage billing.')
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Sign in to manage billing.')
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}`, ...init.headers },
  })
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) throw new Error(typeof body.message === 'string' ? body.message : 'Billing request failed.')
  return body
}

export async function startCheckout(productId: BillingProductId) {
  const body = await billingFetch('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ productId }) })
  if (typeof body.checkoutUrl !== 'string' || typeof body.paymentIntentId !== 'string') throw new Error('Spotflow checkout details were not returned.')
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

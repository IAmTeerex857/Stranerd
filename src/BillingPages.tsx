import { useEffect, useState } from 'react'
import { ArrowRight, Check, CircleAlert, Clock3, RefreshCw } from 'lucide-react'
import { Page } from './PublicLayout'
import { getBillingStatus } from './lib/billing'
import { useAuth } from './auth-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type BillingView = 'loading' | 'pending' | 'successful' | 'failed' | 'cancelled' | 'refunded' | 'missing' | 'delayed' | 'error' | 'unknown'

const terminalStatuses = new Set(['successful', 'failed', 'cancelled', 'refunded'])

export function BillingSuccessPage() {
  const { user, loading } = useAuth()
  const intentId = new URLSearchParams(window.location.search).get('intent') || window.localStorage.getItem('stranerd.billing.pendingIntent') || ''
  const [status, setStatus] = useState<BillingView>(intentId ? 'pending' : 'missing')
  const [message, setMessage] = useState(intentId ? 'Waiting for a verified payment event. Returning from checkout alone does not add credits.' : 'No payment reference was found in this browser. Open Account to review your balance and payment history.')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!user) return
    if (!intentId) return
    let active = true
    let attempts = 0
    let timer: number | undefined
    async function poll() {
      try {
        const result = await getBillingStatus(intentId)
        if (!active) return
        const nextStatus = result.intent.status
        if (result.intent.status === 'successful') {
          window.localStorage.removeItem('stranerd.billing.pendingIntent')
          setMessage(`${result.intent.credits} credits were applied to your account.`)
          setStatus('successful')
          return
        }
        if (terminalStatuses.has(nextStatus)) {
          window.localStorage.removeItem('stranerd.billing.pendingIntent')
          setStatus(nextStatus as BillingView)
          setMessage(nextStatus === 'refunded' ? 'This payment was refunded. Any associated purchased credits are no longer available.' : `This payment is ${nextStatus}. No unverified credits were added.`)
          return
        }
        if (nextStatus !== 'pending') {
          setStatus('unknown')
          setMessage(`The payment has an unrecognized status (${nextStatus}). Your balance has not been changed by this page.`)
          return
        }
      } catch (error) {
        if (!active) return
        const text = error instanceof Error ? error.message : 'Payment status could not be checked.'
        if (text.toLowerCase().includes('not found')) {
          setStatus('missing')
          setMessage('This payment reference was not found for your account. No credits were added.')
          return
        }
        if (attempts >= 2) {
          setStatus('error')
          setMessage(text)
          return
        }
      }
      attempts += 1
      if (active && attempts < 30) timer = window.setTimeout(poll, 2000)
      else if (active) {
        setStatus('delayed')
        setMessage('Confirmation is taking longer than expected. No unverified credits were added; you can safely check again.')
      }
    }
    void poll()
    return () => { active = false; if (timer) window.clearTimeout(timer) }
  }, [intentId, retryKey, user])

  if (!loading && !user) return <Page><main className="status-page billing-status-page"><Card><span className="billing-status-icon neutral"><CircleAlert /></span><span className="eyebrow">Private payment status</span><h1>Sign in to confirm payment.</h1><p>Your payment and credit balance can only be checked from the account that started checkout.</p><Button asChild><a className="public-cta" href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Continue with Google<ArrowRight size={15} /></a></Button></Card></main></Page>

  const successful = status === 'successful'
  const waiting = status === 'loading' || status === 'pending'
  const retryable = status === 'error' || status === 'delayed'
  const title: Record<BillingView, string> = {
    loading: 'Preparing payment check.', pending: 'Confirming your payment.', successful: 'Payment confirmed.', failed: 'Payment failed.', cancelled: 'Payment cancelled.', refunded: 'Payment refunded.', missing: 'Payment not found.', delayed: 'Confirmation is delayed.', error: 'Status check unavailable.', unknown: 'Payment needs review.',
  }
  return <Page><main className="status-page billing-status-page"><Card className={`billing-status-card ${status}`}>
    <span className={`billing-status-icon ${successful ? 'success' : waiting ? 'waiting' : 'attention'}`}>{successful ? <Check /> : waiting ? <Clock3 /> : <CircleAlert />}</span>
    <span className="eyebrow">Secure billing status</span><h1>{title[status]}</h1><p>{message}</p>
    {waiting && <div className="billing-status-progress" aria-label="Checking payment status"><i /></div>}
    <small>Credits are applied only after server verification. This page cannot add them on its own.</small>
    <div className="billing-status-actions">{retryable && <Button onClick={() => { setStatus('pending'); setMessage('Checking again for a verified payment event.'); setRetryKey((value) => value + 1) }}><RefreshCw size={15} />Check again</Button>}<Button variant={successful ? 'default' : 'outline'} asChild><a href="/account">View account<ArrowRight size={15} /></a></Button>{!successful && !waiting && <Button variant="ghost" asChild><a href="/pricing">Return to pricing</a></Button>}</div>
  </Card></main></Page>
}

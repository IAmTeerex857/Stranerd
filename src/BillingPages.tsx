import { useEffect, useState } from 'react'
import { ArrowRight, CircleAlert } from 'lucide-react'
import { Page } from './PublicLayout'
import { getBillingStatus } from './lib/billing'
import { useAuth } from './auth-context'

export function BillingSuccessPage() {
  const { user, loading } = useAuth()
  const intentId = new URLSearchParams(window.location.search).get('intent') || window.localStorage.getItem('stranerd.billing.pendingIntent') || ''
  const [status, setStatus] = useState('pending')
  const [message, setMessage] = useState('Waiting for Spotflow to confirm your payment securely.')

  useEffect(() => {
    if (!user) return
    let active = true
    let attempts = 0
    async function poll() {
      try {
        const result = await getBillingStatus(intentId || undefined)
        if (!active) return
        setStatus(result.intent.status)
        if (result.intent.status === 'successful') {
          window.localStorage.removeItem('stranerd.billing.pendingIntent')
          setMessage(`${result.intent.credits} credits were applied to your account.`)
          setStatus('successful')
          window.setTimeout(() => window.location.replace('/account'), 900)
          return
        }
        if (['failed', 'cancelled', 'refunded'].includes(result.intent.status)) {
          window.localStorage.removeItem('stranerd.billing.pendingIntent')
          setMessage(`This payment is ${result.intent.status}. No unverified credits were added.`)
          return
        }
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : 'Payment status could not be checked.')
      }
      attempts += 1
      if (active && attempts < 30) window.setTimeout(poll, 2000)
      else if (active) setMessage('Confirmation is taking longer than expected. You can check your account again shortly.')
    }
    void poll()
    return () => { active = false }
  }, [intentId, user])

  if (!loading && !user) return <Page><main className="status-page"><div><span className="eyebrow">Payment return</span><h1>Sign in to confirm payment.</h1><a className="public-cta" href={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Continue with Google</a></div></main></Page>
  return <Page><main className="status-page"><div>{status === 'failed' ? <CircleAlert size={24} /> : <span className={status === 'successful' ? 'status-complete' : 'status-mark'} />}<span className="eyebrow">Secure Spotflow checkout</span><h1>{status === 'successful' ? 'Payment confirmed. Redirecting...' : 'Confirming payment.'}</h1><p>{message}</p>{status !== 'successful' && <a className="public-cta" href="/account">View account<ArrowRight size={15} /></a>}</div></main></Page>
}

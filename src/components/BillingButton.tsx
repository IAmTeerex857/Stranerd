import { useState, type ReactNode } from 'react'
import { useAuth } from '../auth-context'
import { startCheckout, type BillingProductId } from '../lib/billing'

export function BillingButton({ productId, children, className }: { productId: BillingProductId; children: ReactNode; className?: string }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  async function checkout() {
    if (!user) {
      window.location.assign(`/login?next=${encodeURIComponent('/pricing')}`)
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      await startCheckout(productId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Checkout could not be started.')
      setLoading(false)
    }
  }

  return <><button className={className} onClick={checkout} disabled={loading}>{loading ? 'Opening checkout...' : children}</button>{error && <small className="billing-inline-error">{error}</small>}</>
}

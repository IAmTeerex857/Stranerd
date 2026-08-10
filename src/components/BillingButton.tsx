import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth-context'
import { startCheckout, type BillingProductId } from '../lib/billing'
import { Button } from '@/components/ui/button'

export function BillingButton({ productId, children, className }: { productId: BillingProductId; children: ReactNode; className?: string }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    const reset = () => setLoading(false)
    window.addEventListener('pageshow', reset)
    window.addEventListener('focus', reset)
    return () => {
      window.removeEventListener('pageshow', reset)
      window.removeEventListener('focus', reset)
    }
  }, [])

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

  return <><Button className={className} onClick={checkout} disabled={loading}>{loading ? 'Opening checkout...' : children}</Button>{error && <small className="billing-inline-error">{error}</small>}</>
}

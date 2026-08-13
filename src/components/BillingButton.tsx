import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth-context'
import { startCheckout, type BillingProductId, type BillingRail } from '../lib/billing'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowRight, Check, LockKeyhole, Minus, Plus } from 'lucide-react'

const prices = {
  subscription: { ngn: 2500, usd_card: 5, stablecoin: 5 },
  payg_100: { ngn: 500, usd_card: 2, stablecoin: 2 },
} satisfies Record<BillingProductId, Record<BillingRail, number>>

function money(value: number, rail: BillingRail) {
  return rail === 'ngn'
    ? `NGN ${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(value)}`
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function rate(rail: BillingRail) {
  return rail === 'ngn' ? 'NGN 5 / credit' : '$0.02 / credit'
}

export function BillingButton({ productId, rail = 'ngn', children, className }: { productId: BillingProductId; rail?: BillingRail; children: ReactNode; className?: string }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const payg = productId === 'payg_100'
  const total = prices[productId][rail] * (payg ? quantity : 1)
  const provider = rail === 'ngn' ? 'Spotflow' : 'Bachs'

  useEffect(() => {
    const reset = () => setLoading(false)
    window.addEventListener('pageshow', reset)
    window.addEventListener('focus', reset)
    return () => {
      window.removeEventListener('pageshow', reset)
      window.removeEventListener('focus', reset)
    }
  }, [])

  function reviewCheckout() {
    if (!user) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`)
      return
    }
    setOpen(true)
  }

  async function checkout() {
    setLoading(true)
    setError(undefined)
    try {
      await startCheckout(productId, rail, payg ? quantity : 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Checkout could not be started.')
      setLoading(false)
    }
  }

  return <div className="billing-button-wrap">
    <Button className={className} onClick={reviewCheckout} disabled={loading}>{children}<ArrowRight size={15} /></Button>
    <Dialog open={open} onOpenChange={(next) => { if (!loading) setOpen(next) }}>
      <DialogContent className={`billing-confirmation ${payg ? 'payg-confirmation' : 'subscription-confirmation'}`}>
        <DialogHeader>
          <span className="billing-dialog-kicker">{payg ? 'Pay as you go' : 'Subscribe'}</span>
          <DialogTitle>{payg ? 'Buy credits' : 'Stranerd Plus'}</DialogTitle>
          {!payg && <div className="subscription-price"><strong>{money(total, rail)}</strong><span>/ month</span></div>}
          <DialogDescription>{payg ? 'Buy a pack when you need one — nothing recurring. Purchased credits never expire and are spent last.' : '500 credits every billing cycle, topped back up automatically. Cancel anytime — credits stay until the cycle ends.'}</DialogDescription>
        </DialogHeader>
        {payg ? <div className="payg-picker">
          <div className="payg-stepper-row"><strong>Packs of 100 credits</strong><div className="payg-stepper" aria-label="Number of credit packs"><Button variant="ghost" size="icon" aria-label="Remove one pack" disabled={quantity === 1 || loading} onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus /></Button><output aria-live="polite">{quantity}</output><Button variant="ghost" size="icon" aria-label="Add one pack" disabled={quantity === 20 || loading} onClick={() => setQuantity((value) => Math.min(20, value + 1))}><Plus /></Button></div></div>
          <dl><div><dt>Credits</dt><dd>{quantity * 100}</dd></div><div><dt>Rate</dt><dd>{rate(rail)}</dd></div><div className="payg-total"><dt>Total</dt><dd>{money(total, rail)}</dd></div></dl>
        </div> : <ul className="subscription-benefits"><li><Check />500 credits monthly — about 50 Voice sessions</li><li><Check />Voice keeps renewing mid-conversation without a top-up</li><li><Check />Everything anatomy stays free — credits power only the AI</li></ul>}
        <div className="billing-dialog-footer"><p><LockKeyhole />Secure checkout by {provider} · you'll confirm payment on the next screen</p><Button className={payg ? 'payg-checkout' : 'subscription-checkout'} onClick={checkout} disabled={loading}>{loading ? 'Opening secure checkout...' : <>Continue to payment{payg ? ` · ${money(total, rail)}` : ''}<ArrowRight /></>}</Button>{error && <small className="billing-inline-error" role="alert">{error}</small>}</div>
      </DialogContent>
    </Dialog>
  </div>
}

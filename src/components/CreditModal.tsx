import { useEffect, useRef } from 'react'
import { ArrowRight, WalletCards, X } from 'lucide-react'
import { BillingButton } from './BillingButton'

export type CreditPrompt = {
  action: string
  required: number
}

type Props = {
  prompt?: CreditPrompt
  balance: number
  onClose: () => void
}

export function CreditModal({ prompt, balance, onClose }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!prompt) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose, prompt])

  if (!prompt) return null

  return <div className="credit-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="credit-modal" role="dialog" aria-modal="true" aria-labelledby="credit-modal-title" aria-describedby="credit-modal-description">
      <header><span><WalletCards size={16} />Credits required</span><button ref={closeButton} onClick={onClose} aria-label="Close credit dialog"><X size={17} /></button></header>
      <div className="credit-modal-copy"><span>Not enough credits</span><h2 id="credit-modal-title">Add credits to continue.</h2><p id="credit-modal-description">{prompt.action} requires {prompt.required} {prompt.required === 1 ? 'credit' : 'credits'}. Your current balance is {balance}.</p></div>
      <dl><div><dt>Required</dt><dd>{prompt.required}</dd></div><div><dt>Available</dt><dd>{balance}</dd></div></dl>
      <div className="credit-modal-actions"><BillingButton productId="payg_100">Buy 100 credits</BillingButton><a href="/pricing">View all options<ArrowRight size={15} /></a></div>
      <small>Your action was not completed and no credits were charged.</small>
    </section>
  </div>
}

import { ArrowRight, WalletCards } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
  return <Dialog open={Boolean(prompt)} onOpenChange={(open) => { if (!open) onClose() }}>
    {prompt && <DialogContent className="credit-modal sm:max-w-md">
      <DialogHeader><span className="dialog-icon"><WalletCards size={18} /></span><DialogTitle>Add credits to continue</DialogTitle><DialogDescription>{prompt.action} requires {prompt.required} {prompt.required === 1 ? 'credit' : 'credits'}. Your current balance is {balance}.</DialogDescription></DialogHeader>
      <dl><div><dt>Required</dt><dd>{prompt.required}</dd></div><div><dt>Available</dt><dd>{balance}</dd></div></dl>
      <div className="credit-modal-actions"><Button asChild><a href="/pricing">Choose a payment method<ArrowRight size={15} /></a></Button></div>
      <small>Your action was not completed and no credits were charged.</small>
    </DialogContent>}
  </Dialog>
}

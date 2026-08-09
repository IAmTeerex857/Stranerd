import { ArrowRight, Check, CircleAlert } from 'lucide-react'
import { AccountPage, AuthCallbackPage, LoginPage } from './AuthPages'
import { Page } from './PublicLayout'
import { LegalPage } from './LegalPages'
import { BillingButton } from './components/BillingButton'
import { BillingSuccessPage } from './BillingPages'
import { LandingPage } from './LandingPage'

const legalPaths = new Set(['/legal/privacy', '/legal/terms', '/legal/refunds'])

function PricingPage() {
  return <Page><main className="public-page"><header className="public-title"><span className="eyebrow">Simple pricing</span><h1>Learn freely. Use AI when it helps.</h1><p>Core anatomy models, manual and guided Labs, verified assessments, and default flashcards remain available without AI credits.</p></header><section className="pricing-grid"><article><span>Free</span><h2>NGN 0</h2><p>Explore the complete anatomy learning workspace.</p><ul><li><Check size={15} />20 one-time signup credits</li><li><Check size={15} />All anatomy models and Labs</li><li><Check size={15} />Verified assessments and flashcards</li></ul><a href="/app">Start learning</a></article><article className="featured"><span>Stranerd Plus</span><h2>NGN 2,500 <small>/ month</small></h2><p>A monthly AI allowance for regular study.</p><ul><li><Check size={15} />500 credits each billing cycle</li><li><Check size={15} />Cost shown before every AI action</li><li><Check size={15} />Cancel with access through the period</li></ul><BillingButton className="public-cta" productId="subscription">Subscribe to Plus</BillingButton></article><article><span>Credit pack</span><h2>NGN 500</h2><p>Add credits without a subscription.</p><ul><li><Check size={15} />100 purchased credits</li><li><Check size={15} />Credits do not expire</li><li><Check size={15} />Buy packs repeatedly</li></ul><BillingButton productId="payg_100">Buy 100 credits</BillingButton></article></section></main></Page>
}

function StatusPage({ kind }: { kind: 'success' | 'cancelled' }) {
  const content = {
    success: ['Confirming payment', 'Your return from checkout is not proof of payment.', 'Credits will appear only after a verified server-to-server payment event.'],
    cancelled: ['Checkout cancelled', 'No payment was confirmed and no credits were added.', 'You can return to pricing whenever you are ready.'],
  }[kind]
  return <Page><main className="status-page"><div>{kind === 'cancelled' ? <CircleAlert size={24} /> : <span className="status-mark" />}<span className="eyebrow">Stranerd account</span><h1>{content[0]}</h1><p>{content[1]}</p><small>{content[2]}</small><a className="public-cta" href={kind === 'cancelled' ? '/pricing' : '/app'}>{kind === 'cancelled' ? 'Return to pricing' : 'Continue to anatomy'}<ArrowRight size={15} /></a></div></main></Page>
}

function NotFoundPage() {
  return <Page><main className="status-page"><div><span className="eyebrow">404</span><h1>Page not found.</h1><p>The requested Stranerd page does not exist.</p><a className="public-cta" href="/">Return home</a></div></main></Page>
}

export function PublicPages({ path }: { path: string }) {
  if (path === '/') return <LandingPage />
  if (path === '/pricing') return <PricingPage />
  if (path === '/login') return <LoginPage />
  if (path === '/auth/callback') return <AuthCallbackPage />
  if (path === '/account') return <AccountPage />
  if (path === '/billing/success') return <BillingSuccessPage />
  if (path === '/billing/cancelled') return <StatusPage kind="cancelled" />
  if (legalPaths.has(path)) return <LegalPage path={path} />
  return <NotFoundPage />
}

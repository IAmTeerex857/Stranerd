import { lazy, Suspense } from 'react'
import { ArrowRight, Check, CircleAlert } from 'lucide-react'
import { Page } from './PublicLayout'
import { BillingButton } from './components/BillingButton'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const LandingPage = lazy(() => import('./LandingPage').then((module) => ({ default: module.LandingPage })))
const LoginPage = lazy(() => import('./AuthPages').then((module) => ({ default: module.LoginPage })))
const AuthCallbackPage = lazy(() => import('./AuthPages').then((module) => ({ default: module.AuthCallbackPage })))
const AccountPage = lazy(() => import('./AuthPages').then((module) => ({ default: module.AccountPage })))
const LegalPage = lazy(() => import('./LegalPages').then((module) => ({ default: module.LegalPage })))
const BillingSuccessPage = lazy(() => import('./BillingPages').then((module) => ({ default: module.BillingSuccessPage })))

const legalPaths = new Set(['/legal/privacy', '/legal/terms', '/legal/refunds'])

function PricingPage() {
  return <Page><main className="public-page"><header className="public-title"><h1>Learn freely. Use AI when it helps.</h1><p>Core anatomy models, guided Labs, free dissection, verified assessments, and default flashcards remain available without AI credits.</p></header><section className="pricing-grid"><Card><span>Free</span><h2>NGN 0</h2><p>Explore the complete anatomy learning workspace.</p><ul><li><Check size={15} />20 one-time signup credits</li><li><Check size={15} />All anatomy models and Labs</li><li><Check size={15} />Verified assessments and flashcards</li></ul><Button variant="outline" asChild><a href="/app">Start learning</a></Button></Card><Card className="featured"><span>Stranerd Plus</span><h2>NGN 2,500 <small>/ month</small></h2><p>A monthly AI allowance for regular study.</p><ul><li><Check size={15} />500 credits each billing cycle</li><li><Check size={15} />Cost shown before every AI action</li><li><Check size={15} />Cancel with access through the period</li></ul><BillingButton className="public-cta" productId="subscription">Subscribe to Plus</BillingButton></Card><Card><span>Credit pack</span><h2>NGN 500</h2><p>Add credits without a subscription.</p><ul><li><Check size={15} />100 purchased credits</li><li><Check size={15} />Credits do not expire</li><li><Check size={15} />Buy packs repeatedly</li></ul><BillingButton productId="payg_100">Buy 100 credits</BillingButton></Card></section></main></Page>
}

function StatusPage({ kind }: { kind: 'success' | 'cancelled' }) {
  const content = {
    success: ['Confirming payment', 'Your return from checkout is not proof of payment.', 'Credits will appear only after a verified server-to-server payment event.'],
    cancelled: ['Checkout cancelled', 'No payment was confirmed and no credits were added.', 'You can return to pricing whenever you are ready.'],
  }[kind]
  return <Page><main className="status-page"><Card>{kind === 'cancelled' ? <CircleAlert size={24} /> : <span className="status-mark" />}<h1>{content[0]}</h1><p>{content[1]}</p><small>{content[2]}</small><Button asChild><a className="public-cta" href={kind === 'cancelled' ? '/pricing' : '/app'}>{kind === 'cancelled' ? 'Return to pricing' : 'Continue to anatomy'}<ArrowRight size={15} /></a></Button></Card></main></Page>
}

function NotFoundPage() {
  return <Page><main className="status-page"><Card><h1>Page not found.</h1><p>The requested Stranerd page does not exist.</p><Button asChild><a className="public-cta" href="/">Return home</a></Button></Card></main></Page>
}

export function PublicPages({ path }: { path: string }) {
  let page = <NotFoundPage />
  if (path === '/') page = <LandingPage />
  else if (path === '/pricing') page = <PricingPage />
  else if (path === '/login') page = <LoginPage />
  else if (path === '/auth/callback') page = <AuthCallbackPage />
  else if (path === '/account') page = <AccountPage />
  else if (path === '/billing/success') page = <BillingSuccessPage />
  else if (path === '/billing/cancelled') page = <StatusPage kind="cancelled" />
  else if (legalPaths.has(path)) page = <LegalPage path={path} />
  return <Suspense fallback={<main className="route-loading" aria-label="Loading page"><span /></main>}>{page}</Suspense>
}

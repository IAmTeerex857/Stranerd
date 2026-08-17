import { lazy, Suspense } from 'react'
import { ArrowRight, Check, CircleAlert, Sparkles } from 'lucide-react'
import { Page } from './PublicLayout'
import { BillingButton } from './components/BillingButton'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { checkoutRail, useBillingOptions } from './lib/billing'

const LandingPage = lazy(() => import('./LandingPage').then((module) => ({ default: module.LandingPage })))
const LoginPage = lazy(() => import('./AuthPages').then((module) => ({ default: module.LoginPage })))
const AuthCallbackPage = lazy(() => import('./AuthPages').then((module) => ({ default: module.AuthCallbackPage })))
const AccountPage = lazy(() => import('./AuthPages').then((module) => ({ default: module.AccountPage })))
const LegalPage = lazy(() => import('./LegalPages').then((module) => ({ default: module.LegalPage })))
const BillingSuccessPage = lazy(() => import('./BillingPages').then((module) => ({ default: module.BillingSuccessPage })))
const SharedLibraryPage = lazy(() => import('./components/SharedLibraryPage'))

const legalPaths = new Set(['/legal/privacy', '/legal/terms', '/legal/refunds'])

function PricingPage() {
  const options = useBillingOptions()
  const nigeria = options?.country === 'NG'
  const subscriptionRail = checkoutRail(options, 'subscription')
  const packRail = checkoutRail(options, 'payg_100')
  const unavailable = options?.unavailable || (options && (!subscriptionRail || !packRail))

  return <Page themed><main className="public-page pricing-page">
    <header className="public-title pricing-title"><span>Simple pricing</span><h1>Learn anatomy freely.<br /><em>Use AI when it helps.</em></h1><p>Models, Labs, dissection, verified assessments, and included flashcards remain free. Credits power only Nerd Bot and generated AI help.</p></header>
    <section className="pricing-grid" aria-label="Pricing plans">
      <Card className="pricing-free"><span>Always free</span><h2>{nigeria ? '₦0' : '$0'}</h2><p>The complete anatomy learning workspace, with a small AI allowance to begin.</p><ul><li><Check size={15} />20 one-time signup credits</li><li><Check size={15} />All anatomy models and guided Labs</li><li><Check size={15} />Verified assessments and flashcards</li></ul><Button variant="outline" asChild><a href="/app">Start learning<ArrowRight size={15} /></a></Button></Card>
      <Card className="featured"><span className="pricing-recommended"><Sparkles size={12} />For regular study</span><h2>{nigeria ? '₦2,500' : '$5'} <small>/ month</small></h2><p>500 AI credits refreshed each billing cycle, while your anatomy workspace stays free.</p><ul><li><Check size={15} />500 credits each billing cycle</li><li><Check size={15} />Every AI cost shown before you act</li><li><Check size={15} />Cancel with access through the period</li></ul><div className="billing-actions">{!options && <Button disabled>Loading checkout...</Button>}{unavailable && <Button disabled>Checkout currently unavailable</Button>}{subscriptionRail && <BillingButton productId="subscription" rail={subscriptionRail}>Get Plus · {nigeria ? '₦2,500' : '$5'}</BillingButton>}</div></Card>
      <Card><span>Top up anytime</span><h2>{nigeria ? '₦500' : '$2'}</h2><p>100 purchased credits for occasional AI help. No recurring commitment.</p><ul><li><Check size={15} />100 purchased credits</li><li><Check size={15} />Credits never expire</li><li><Check size={15} />Purchased credits are spent last</li></ul><div className="billing-actions">{!options && <Button disabled>Loading checkout...</Button>}{unavailable && <Button disabled>Checkout currently unavailable</Button>}{packRail && <BillingButton productId="payg_100" rail={packRail}>Buy 100 credits · {nigeria ? '₦500' : '$2'}</BillingButton>}</div></Card>
    </section>
    <p className="pricing-footnote">One clear price for your region. Available payment choices are presented in secure checkout.</p>
  </main></Page>
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
  else if (path === '/library/share') page = <SharedLibraryPage />
  else if (legalPaths.has(path)) page = <LegalPage path={path} />
  return <Suspense fallback={<main className="route-loading" aria-label="Loading page"><span /></main>}>{page}</Suspense>
}

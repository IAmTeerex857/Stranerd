import { ArrowRight, Check, CircleAlert } from 'lucide-react'
import { AccountPage, AuthCallbackPage, LoginPage } from './AuthPages'
import { Page } from './PublicLayout'
import { LegalPage } from './LegalPages'
import { BillingButton } from './components/BillingButton'
import { BillingSuccessPage } from './BillingPages'

const legalPaths = new Set(['/legal/privacy', '/legal/terms', '/legal/refunds'])

function HomePage() {
  return <Page><main className="landing-shell"><section className="landing-hero"><div><span className="eyebrow">Anatomy, made active</span><h1>Study the body by exploring it.</h1><p>Inspect interactive anatomy, reveal spatial relationships, complete guided dissections, and test what you understand.</p><div className="hero-actions"><a className="public-cta" href="/app">Open anatomy lab<ArrowRight size={16} /></a><a href="/pricing">View pricing</a></div></div><div className="hero-specimen" aria-label="Stranerd product preview"><span>LIVE STUDY SPACE</span><div className="specimen-orbit"><i /><b>3D</b></div><p>Select · isolate · dissect · recall</p></div></section><section className="product-strip"><span>10 anatomy studies</span><span>Guided dissection</span><span>Authored quizzes</span><span>AI Mentor when you ask</span></section><section className="launch-summary"><span className="eyebrow">Built for active recall</span><h2>Move beyond flat diagrams.</h2><p>Stranerd combines manipulable anatomy with guided activities and concise explanations, keeping the model at the center of each study session.</p></section></main></Page>
}

function PricingPage() {
  return <Page><main className="public-page"><header className="public-title"><span className="eyebrow">Simple pricing</span><h1>Learn freely. Use AI when it helps.</h1><p>Core anatomy models, activities, dissection, notes, and authored quizzes remain available without AI credits.</p></header><section className="pricing-grid"><article><span>Free</span><h2>NGN 0</h2><p>Explore the complete anatomy learning workspace.</p><ul><li><Check size={15} />20 one-time signup credits</li><li><Check size={15} />All anatomy models and activities</li><li><Check size={15} />Notes and deterministic quizzes</li></ul><a href="/app">Start learning</a></article><article className="featured"><span>Stranerd Plus</span><h2>NGN 2,500 <small>/ month</small></h2><p>A monthly AI allowance for regular study.</p><ul><li><Check size={15} />500 credits each billing cycle</li><li><Check size={15} />Explicit, one-credit AI actions</li><li><Check size={15} />Cancel with access through the period</li></ul><BillingButton className="public-cta" productId="subscription">Subscribe in test mode</BillingButton></article><article><span>Credit pack</span><h2>NGN 500</h2><p>Add credits without a subscription.</p><ul><li><Check size={15} />100 purchased credits</li><li><Check size={15} />Credits do not expire</li><li><Check size={15} />Buy packs repeatedly</li></ul><BillingButton productId="payg_100">Buy 100 credits in test mode</BillingButton></article></section></main></Page>
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
  if (path === '/') return <HomePage />
  if (path === '/pricing') return <PricingPage />
  if (path === '/login') return <LoginPage />
  if (path === '/auth/callback') return <AuthCallbackPage />
  if (path === '/account') return <AccountPage />
  if (path === '/billing/success') return <BillingSuccessPage />
  if (path === '/billing/cancelled') return <StatusPage kind="cancelled" />
  if (legalPaths.has(path)) return <LegalPage path={path} />
  return <NotFoundPage />
}

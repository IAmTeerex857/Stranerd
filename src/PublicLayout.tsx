import { ArrowRight, Menu, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import logoUrl from '../Logo Stranerd.png'
import { useAuth } from './auth-context'

function Header() {
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  return <header className="public-header">
    <a className="public-brand" href={user ? '/app' : '/'}><img src={logoUrl} alt="Stranerd" /></a>
    <button className="public-menu-toggle" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-controls="public-navigation" aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</button>
    <nav id="public-navigation" className={menuOpen ? 'open' : ''} aria-label="Primary navigation"><a href="/#how-it-works" onClick={() => setMenuOpen(false)}>Product</a><a href="/#landing-pricing" onClick={() => setMenuOpen(false)}>Pricing</a><a href={user ? '/account' : '/login?mode=signin&next=/app'}>{user ? 'Account' : 'Sign in'}</a><a className="public-cta" href="/login?mode=signup&next=/app">Sign up<ArrowRight size={15} /></a></nav>
  </header>
}

function Footer() {
  return <footer className="public-footer"><div><strong>Stranerd</strong><span>Interactive anatomy for active learners.</span></div><nav aria-label="Product"><span>Product</span><a href="/app">Anatomy lab</a><a href="/pricing">Pricing</a><a href="/account">Account</a></nav><nav aria-label="Legal"><span>Legal</span><a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a><a href="/legal/refunds">Refunds</a></nav><small>© 2026 Stranerd Academy Limited</small></footer>
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="public-shell"><Header />{children}<Footer /></div>
}

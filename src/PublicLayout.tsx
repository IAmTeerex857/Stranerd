import { ArrowRight, Menu, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useAuth } from './auth-context'
import { Button } from '@/components/ui/button'

const logoUrl = '/branding/stranerd-wordmark.png'

function Header() {
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  return <header className="public-header">
    <a className="public-brand" href={user ? '/app' : '/'}><img src={logoUrl} alt="Stranerd" /></a>
    <Button variant="ghost" size="icon" className="public-menu-toggle" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-controls="public-navigation" aria-label="Toggle navigation">{menuOpen ? <X /> : <Menu />}</Button>
    <nav id="public-navigation" className={menuOpen ? 'open' : ''} aria-label="Primary navigation"><a href="/#how-it-works" onClick={() => setMenuOpen(false)}>Product</a><a href="/#landing-pricing" onClick={() => setMenuOpen(false)}>Pricing</a><a href={user ? '/account' : '/login?mode=signin&next=/app'}>{user ? 'Account' : 'Sign in'}</a><Button asChild><a className="public-cta" href="/login?mode=signup&next=/app">Sign up<ArrowRight size={15} /></a></Button></nav>
  </header>
}

function Footer() {
  return <footer className="public-footer"><div><strong>Stranerd</strong><span>Interactive anatomy for active learners.</span></div><nav aria-label="Product"><span>Product</span><a href="/app">Anatomy lab</a><a href="/pricing">Pricing</a><a href="/account">Account</a></nav><nav aria-label="Legal"><span>Legal</span><a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a><a href="/legal/refunds">Refunds</a></nav><small>© 2026 Stranerd Academy Limited</small></footer>
}

export function Page({ children, themed = false }: { children: ReactNode; themed?: boolean }) {
  return <div className={`public-shell ${themed ? 'account-theme-shell' : ''}`}><Header />{children}<Footer /></div>
}

import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, CircleUserRound, Compass, Menu, Microscope, Moon, Sparkles, Sun, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useAuth } from './auth-context'
import { useTheme } from './theme-context'
import { Button } from '@/components/ui/button'
import { anatomyModels } from './data/models'

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

function AccountHeader() {
  const { user, balance } = useAuth()
  const { resolvedTheme, setPreference } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const name = user?.user_metadata.full_name || user?.email || 'Stranerd learner'
  const avatar = user?.user_metadata.avatar_url
  const initials = name.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase()
  const credits = balance ? balance.freeBalance + balance.subscriptionBalance + balance.purchasedBalance : 0
  return <><header className="account-topbar"><div className="account-mobile-title"><button onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu /></button><strong>Account</strong></div><div className="account-topbar-path"><a href="/app"><ArrowLeft />Back to Explore</a><i /><span>Account</span><ChevronRight /><strong>Credits &amp; plan</strong></div><div className="account-topbar-user"><a className="account-mobile-credits" href="/account"><Sparkles /><b>{credits}</b></a><Button variant="outline" size="icon" aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme`} title="Toggle theme" onClick={() => setPreference(resolvedTheme === 'dark' ? 'light' : 'dark')}>{resolvedTheme === 'dark' ? <Sun /> : <Moon />}</Button>{avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <span>{initials}</span>}</div></header>{menuOpen && <aside className="account-mobile-drawer"><header><img src={logoUrl} alt="Stranerd" /><button onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X /></button></header><nav><a href="/app"><Compass />Explore</a><a href="/app?view=library"><BookOpen />Learn</a><a href="/app?view=lab"><Microscope />Lab</a><a className="active" href="/account"><CircleUserRound />Account</a></nav><div><header><span>Subjects</span><b>{anatomyModels.length}</b></header>{anatomyModels.map((model) => <a key={model.id} href={`/app?model=${model.id}`}><i />{model.name}<small>{model.system}</small></a>)}</div></aside>}</>
}

function AccountMobileNav() {
  return <nav className="account-mobile-nav" aria-label="Workspace navigation"><a href="/app"><Compass /><span>Explore</span></a><a href="/app?view=library"><BookOpen /><span>Learn</span></a><a href="/app?view=lab"><Microscope /><span>Lab</span></a><a className="active" href="/account"><CircleUserRound /><span>Account</span></a></nav>
}

function Footer() {
  return <footer className="public-footer"><div><strong>Stranerd</strong><span>Interactive anatomy for active learners.</span></div><nav aria-label="Product"><span>Product</span><a href="/app">Anatomy lab</a><a href="/pricing">Pricing</a><a href="/account">Account</a></nav><nav aria-label="Legal"><span>Legal</span><a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a><a href="/legal/refunds">Refunds</a></nav><small>© 2026 Stranerd Academy Limited</small></footer>
}

export function Page({ children, themed = false, account = false }: { children: ReactNode; themed?: boolean; account?: boolean }) {
  return <div className={`public-shell ${themed ? 'account-theme-shell' : ''} ${account ? 'account-shell' : ''}`}>{account ? <AccountHeader /> : <Header />}{children}{account && <AccountMobileNav />}{!account && <Footer />}</div>
}

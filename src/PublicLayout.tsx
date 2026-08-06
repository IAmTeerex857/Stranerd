import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import logoUrl from '../Logo Stranerd.png'
import { useAuth } from './auth-context'

function Header() {
  const { user } = useAuth()
  return <header className="public-header">
    <a className="public-brand" href="/"><img src={logoUrl} alt="Stranerd" /></a>
    <nav aria-label="Primary navigation"><a href="/pricing">Pricing</a><a href={user ? '/account' : '/login'}>{user ? 'Account' : 'Sign in'}</a><a className="public-cta" href="/app">Start learning<ArrowRight size={15} /></a></nav>
  </header>
}

function Footer() {
  return <footer className="public-footer"><span>Stranerd · Interactive anatomy</span><nav aria-label="Legal"><a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a><a href="/legal/refunds">Refunds</a></nav></footer>
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="public-shell"><Header />{children}<Footer /></div>
}

import { ArrowRight, Moon, Sun } from 'lucide-react'
import { useLayoutEffect, useState, type ReactNode } from 'react'
import logoUrl from '../Logo Stranerd.png'
import { useAuth } from './auth-context'

function Header() {
  const { user } = useAuth()
  const [theme, setTheme] = useState<'dark' | 'light'>(() => window.localStorage.getItem('stranerd.theme') === 'light' ? 'light' : 'dark')
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('stranerd.theme', theme)
  }, [theme])
  return <header className="public-header">
    <a className="public-brand" href={user ? '/app' : '/'}><img src={logoUrl} alt="Stranerd" /></a>
    <nav aria-label="Primary navigation"><button className="public-theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button><a href="/pricing">Pricing</a><a href={user ? '/account' : '/login'}>{user ? 'Account' : 'Sign in'}</a><a className="public-cta" href="/app">Start learning<ArrowRight size={15} /></a></nav>
  </header>
}

function Footer() {
  return <footer className="public-footer"><span>Stranerd · Interactive anatomy</span><nav aria-label="Legal"><a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a><a href="/legal/refunds">Refunds</a></nav></footer>
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="public-shell"><Header />{children}<Footer /></div>
}

import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { AuthProvider } from './auth'
import { ThemeProvider } from './theme'
import { bootstrapTheme } from './theme-utils'
import { PreferencesProvider } from './preferences'
import { bootstrapPreferences } from './preferences-utils'
import { TooltipProvider } from './components/ui/tooltip'
import './shadcn.css'
import './styles.css'
import './landing.css'
import './app.css'
import './design-system.css'
import './learn-redesign.css'
import './lab-redesign.css'
import './support-redesign.css'

const App = lazy(() => import('./App'))
const PublicPages = lazy(() => import('./PublicPages').then((module) => ({ default: module.PublicPages })))
const HeartCandidateTestView = lazy(() => import('./components/HeartCandidateTestView').then((module) => ({ default: module.HeartCandidateTestView })))

class AppBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Stranerd recovered from a runtime error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="fatal-error">
        <span>STRANERD · RECOVERY</span>
        <h1>The interactive viewer stopped unexpectedly.</h1>
        <p>{this.state.error.message}</p>
        <div>
          <button onClick={() => window.location.reload()}>Reload demo</button>
          <button onClick={() => {
            window.localStorage.removeItem('stranerd.anatomy.v1')
            window.location.reload()
          }}>Reset local settings</button>
        </div>
      </main>
    )
  }
}

const testView = new URLSearchParams(window.location.search).get('test')
const path = window.location.pathname.length > 1 ? window.location.pathname.replace(/\/+$/, '') : '/'
const themeEnabled = path === '/app' || path === '/account'
bootstrapTheme(themeEnabled)
bootstrapPreferences(themeEnabled)

createRoot(document.getElementById('root')!).render(
  <AppBoundary>
    <AuthProvider>
      <ThemeProvider enabled={themeEnabled}>
        <PreferencesProvider enabled={themeEnabled}>
          <TooltipProvider>
            <Suspense fallback={<main className="route-loading" aria-label="Loading Stranerd"><span /></main>}>
              {testView === 'heart-candidate' ? <HeartCandidateTestView /> : path === '/app' ? <App /> : <PublicPages path={path} />}
            </Suspense>
            <Analytics />
          </TooltipProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </AuthProvider>
  </AppBoundary>,
)

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { HeartCandidateTestView } from './components/HeartCandidateTestView'
import './styles.css'

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

createRoot(document.getElementById('root')!).render(
  <AppBoundary>{testView === 'heart-candidate' ? <HeartCandidateTestView /> : <App />}</AppBoundary>,
)

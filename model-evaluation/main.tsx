import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '../src/theme'
import { PreferencesProvider } from '../src/preferences'
import { TooltipProvider } from '../src/components/ui/tooltip'
import { bootstrapTheme } from '../src/theme-utils'
import { bootstrapPreferences } from '../src/preferences-utils'
import { EvaluationPage } from './EvaluationPage'
import '../src/shadcn.css'
import '../src/styles.css'
import '../src/app.css'
import '../src/design-system.css'
import './model-evaluation.css'

bootstrapTheme(true)
bootstrapPreferences(true)

createRoot(document.getElementById('root')!).render(
  <ThemeProvider enabled>
    <PreferencesProvider enabled>
      <TooltipProvider><EvaluationPage /></TooltipProvider>
    </PreferencesProvider>
  </ThemeProvider>,
)

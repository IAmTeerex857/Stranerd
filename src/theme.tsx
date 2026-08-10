import { useEffect, useState, type ReactNode } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { ThemeContext, useTheme } from './theme-context'
import { applyTheme, persistThemePreference, readThemePreference, resolveTheme, THEME_QUERY, type ThemePreference } from './theme-utils'
import { Button } from '@/components/ui/button'

export function ThemeProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => enabled ? readThemePreference() : 'dark')
  const [systemDark, setSystemDark] = useState(() => Boolean(window.matchMedia?.(THEME_QUERY).matches))
  const resolvedTheme = resolveTheme(enabled ? preference : 'dark', systemDark)

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  useEffect(() => {
    if (!enabled || preference !== 'system' || !window.matchMedia) return
    const media = window.matchMedia(THEME_QUERY)
    const update = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [enabled, preference])

  function setPreference(next: ThemePreference) {
    if (next === 'system') setSystemDark(Boolean(window.matchMedia?.(THEME_QUERY).matches))
    setPreferenceState(next)
    persistThemePreference(next)
  }

  return <ThemeContext value={{ preference, resolvedTheme, setPreference }}>{children}</ThemeContext>
}

const options = [
  { value: 'system' as const, label: 'System', Icon: Monitor },
  { value: 'light' as const, label: 'Light', Icon: Sun },
  { value: 'dark' as const, label: 'Dark', Icon: Moon },
]

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme()
  return <fieldset className={`theme-control ${compact ? 'compact' : ''}`} aria-label="Appearance">
    <legend>Appearance</legend>
    {options.map(({ value, label, Icon }) => <Button variant={preference === value ? 'default' : 'ghost'} size="sm" key={value} type="button" className={preference === value ? 'active' : ''} aria-pressed={preference === value} title={`${label} theme`} onClick={() => setPreference(value)}><Icon size={14} /><span>{label}</span></Button>)}
  </fieldset>
}

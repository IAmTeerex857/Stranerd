export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_QUERY = '(prefers-color-scheme: dark)'
const STORAGE_KEY = 'stranerd.theme'

export function parseThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
}

export function readThemePreference() {
  try {
    return parseThemePreference(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'system' as const
  }
}

export function persistThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // The selected theme still applies when storage is unavailable.
  }
}

export function applyTheme(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#ffffff' : '#000000')
}

export function bootstrapTheme(enabled: boolean) {
  const preference = enabled ? readThemePreference() : 'dark'
  const systemDark = enabled && window.matchMedia?.(THEME_QUERY).matches
  applyTheme(resolveTheme(preference, Boolean(systemDark)))
}

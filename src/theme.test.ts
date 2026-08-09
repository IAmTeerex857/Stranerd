import { describe, expect, it } from 'vitest'
import { parseThemePreference, resolveTheme } from './theme-utils'

describe('theme preference', () => {
  it('accepts explicit themes and treats other values as system', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('system')).toBe('system')
    expect(parseThemePreference('invalid')).toBe('system')
    expect(parseThemePreference(null)).toBe('system')
  })

  it('resolves system preferences without changing explicit themes', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

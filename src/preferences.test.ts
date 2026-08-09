import { describe, expect, it } from 'vitest'
import { parseMotionPreference, resolveReducedMotion } from './preferences-utils'

describe('motion preference', () => {
  it('safely parses persisted preferences', () => {
    expect(parseMotionPreference(null)).toBe('system')
    expect(parseMotionPreference('{broken')).toBe('system')
    expect(parseMotionPreference(JSON.stringify({ motion: 'reduce' }))).toBe('reduce')
    expect(parseMotionPreference(JSON.stringify({ motion: 'full' }))).toBe('system')
  })

  it('never overrides a system request to reduce motion', () => {
    expect(resolveReducedMotion('system', true)).toBe(true)
    expect(resolveReducedMotion('system', false)).toBe(false)
    expect(resolveReducedMotion('reduce', false)).toBe(true)
  })
})

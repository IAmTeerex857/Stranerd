import { describe, expect, it } from 'vitest'
import { safeReturnPath } from './auth-utils'

describe('safeReturnPath', () => {
  it('allows local application paths', () => {
    expect(safeReturnPath('/app?model=heart')).toBe('/app?model=heart')
  })

  it('rejects external and protocol-relative redirects', () => {
    expect(safeReturnPath('https://example.com')).toBe('/account')
    expect(safeReturnPath('//example.com')).toBe('/account')
    expect(safeReturnPath('/\\example.com')).toBe('/account')
    expect(safeReturnPath('/app\nLocation: https://example.com')).toBe('/account')
  })
})

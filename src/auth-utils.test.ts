import { describe, expect, it } from 'vitest'
import { loginPath, safeReturnPath } from './auth-utils'

describe('safeReturnPath', () => {
  it('allows local application paths', () => {
    expect(safeReturnPath('/app?model=heart')).toBe('/app?model=heart')
  })

  it('rejects external and protocol-relative redirects', () => {
    expect(safeReturnPath('https://example.com')).toBe('/account')
    expect(safeReturnPath('//example.com')).toBe('/account')
    expect(safeReturnPath('/\\example.com')).toBe('/account')
  })

  it('builds an encoded login destination for an exact workspace item', () => {
    expect(loginPath('/app?view=lab&activity=heart-flow')).toBe('/login?next=%2Fapp%3Fview%3Dlab%26activity%3Dheart-flow')
  })
})

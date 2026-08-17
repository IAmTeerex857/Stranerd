import { describe, expect, it, vi } from 'vitest'
import { BILLING_SUCCESS_REDIRECT_MS, scheduleAccountRedirect } from './billingRedirect'

describe('billing success redirect', () => {
  it('returns to the account after briefly showing confirmation', () => {
    const redirect = vi.fn()
    const schedule = vi.fn((callback: () => void, _delay: number) => {
      expect(_delay).toBe(BILLING_SUCCESS_REDIRECT_MS)
      callback()
      return 42
    })
    expect(scheduleAccountRedirect(schedule, redirect)).toBe(42)
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), BILLING_SUCCESS_REDIRECT_MS)
    expect(redirect).toHaveBeenCalledOnce()
  })
})

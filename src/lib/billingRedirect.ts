export const BILLING_SUCCESS_REDIRECT_MS = 900

type Schedule = (callback: () => void, delay: number) => number

export function scheduleAccountRedirect(schedule: Schedule = window.setTimeout, redirect = () => window.location.replace('/account')) {
  return schedule(redirect, BILLING_SUCCESS_REDIRECT_MS)
}

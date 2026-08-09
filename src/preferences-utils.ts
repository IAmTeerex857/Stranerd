export type MotionPreference = 'system' | 'reduce'

export const PREFERENCES_KEY = 'stranerd.preferences.v1'
export const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function parseMotionPreference(raw: string | null): MotionPreference {
  if (!raw) return 'system'
  try {
    const value = JSON.parse(raw) as { motion?: unknown }
    return value.motion === 'reduce' ? 'reduce' : 'system'
  } catch {
    return 'system'
  }
}

export function readMotionPreference() {
  try {
    return parseMotionPreference(window.localStorage.getItem(PREFERENCES_KEY))
  } catch {
    return 'system' as const
  }
}

export function persistMotionPreference(motion: MotionPreference) {
  try {
    if (motion === 'system') window.localStorage.removeItem(PREFERENCES_KEY)
    else window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ motion }))
  } catch {
    // The preference still applies for the current page when storage is unavailable.
  }
}

export function resolveReducedMotion(preference: MotionPreference, systemReduced: boolean) {
  return preference === 'reduce' || systemReduced
}

export function applyReducedMotion(reduced: boolean) {
  document.documentElement.dataset.reducedMotion = String(reduced)
}

export function bootstrapPreferences(enabled: boolean) {
  const preference = enabled ? readMotionPreference() : 'system'
  const systemReduced = Boolean(window.matchMedia?.(MOTION_QUERY).matches)
  applyReducedMotion(resolveReducedMotion(preference, systemReduced))
}

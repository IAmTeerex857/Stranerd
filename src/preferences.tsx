import { useEffect, useState, type ReactNode } from 'react'
import { Accessibility, Monitor } from 'lucide-react'
import { PreferencesContext, usePreferences } from './preferences-context'
import { applyReducedMotion, MOTION_QUERY, parseMotionPreference, PREFERENCES_KEY, persistMotionPreference, readMotionPreference, resolveReducedMotion, type MotionPreference } from './preferences-utils'

export function PreferencesProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [motion, setMotionState] = useState<MotionPreference>(() => enabled ? readMotionPreference() : 'system')
  const [systemReduced, setSystemReduced] = useState(() => Boolean(window.matchMedia?.(MOTION_QUERY).matches))
  const reducedMotion = resolveReducedMotion(enabled ? motion : 'system', systemReduced)

  useEffect(() => {
    applyReducedMotion(reducedMotion)
  }, [reducedMotion])

  useEffect(() => {
    if (!window.matchMedia) return
    const media = window.matchMedia(MOTION_QUERY)
    const update = (event: MediaQueryListEvent) => setSystemReduced(event.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key === PREFERENCES_KEY || event.key === null) setMotionState(parseMotionPreference(event.newValue))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  function setMotion(next: MotionPreference) {
    setMotionState(next)
    persistMotionPreference(next)
  }

  return <PreferencesContext value={{ motion, reducedMotion, setMotion }}>{children}</PreferencesContext>
}

const options = [
  { value: 'system' as const, label: 'System', Icon: Monitor },
  { value: 'reduce' as const, label: 'Reduce motion', Icon: Accessibility },
]

export function MotionControl() {
  const { motion, setMotion } = usePreferences()
  return <fieldset className="preference-control" aria-label="Motion">
    <legend>Motion</legend>
    {options.map(({ value, label, Icon }) => <button key={value} type="button" className={motion === value ? 'active' : ''} aria-pressed={motion === value} onClick={() => setMotion(value)}><Icon size={15} /><span>{label}</span></button>)}
  </fieldset>
}

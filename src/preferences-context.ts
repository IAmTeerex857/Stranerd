import { createContext, useContext } from 'react'
import type { MotionPreference } from './preferences-utils'

export type PreferencesContextValue = {
  motion: MotionPreference
  reducedMotion: boolean
  setMotion: (motion: MotionPreference) => void
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function usePreferences() {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences must be used within PreferencesProvider')
  return value
}

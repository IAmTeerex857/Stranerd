import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { CreditBalance } from './lib/ai'

export type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  configured: boolean
  balance: CreditBalance | null
  setBalance: (balance: CreditBalance) => void
  signInWithGoogle: (next?: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

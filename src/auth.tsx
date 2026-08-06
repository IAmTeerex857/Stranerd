import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './lib/supabase'
import { AuthContext } from './auth-context'
import { safeReturnPath } from './auth-utils'
import type { CreditBalance } from './lib/ai'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [balance, setBalance] = useState<CreditBalance | null>(null)

  async function loadBalance(userId: string) {
    if (!supabase) return
    const { data } = await supabase.from('credit_wallets').select('free_balance,subscription_balance,purchased_balance').eq('user_id', userId).maybeSingle()
    if (data) setBalance({ freeBalance: data.free_balance, subscriptionBalance: data.subscription_balance, purchasedBalance: data.purchased_balance })
  }

  useEffect(() => {
    if (!supabase) {
      return
    }

    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session)
        setLoading(false)
        if (data.session) void loadBalance(data.session.user.id)
      }
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      if (nextSession) void loadBalance(nextSession.user.id)
      else setBalance(null)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  async function signInWithGoogle(next = '/account') {
    if (!supabase) throw new Error('Supabase is not configured.')
    window.sessionStorage.setItem('stranerd.auth.next', safeReturnPath(next))
    const callback = new URL('/auth/callback', window.location.origin)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callback.toString(),
        scopes: 'openid email profile',
      },
    })
    if (error) throw error
  }

  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    window.location.assign('/')
  }

  return <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, configured: supabaseConfigured, balance, setBalance, signInWithGoogle, signOut }}>{children}</AuthContext.Provider>
}

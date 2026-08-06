import { useEffect, useState } from 'react'
import { ArrowRight, CircleAlert, LogOut, WalletCards } from 'lucide-react'
import { useAuth } from './auth-context'
import { safeReturnPath } from './auth-utils'
import { supabase } from './lib/supabase'
import { Page } from './PublicLayout'
import { GoogleIcon } from './components/GoogleIcon'

type AccountData = {
  profile: { display_name: string | null; email: string | null; avatar_url: string | null } | null
  wallet: { free_balance: number; subscription_balance: number; purchased_balance: number } | null
  transactions: { id: string; amount: number; type: string; feature: string; created_at: string }[]
  subscription: { status: string; current_period_end: string | null; cancel_at_period_end: boolean } | null
}

export function LoginPage() {
  const { user, loading, configured, signInWithGoogle } = useAuth()
  const [error, setError] = useState<string>()
  const next = safeReturnPath(new URLSearchParams(window.location.search).get('next'))

  async function signIn() {
    setError(undefined)
    try {
      await signInWithGoogle(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google sign-in could not be started.')
    }
  }

  return <Page><main className="status-page auth-page"><div><span className="eyebrow">Stranerd account</span><h1>{user ? 'You are signed in.' : 'Continue with Google.'}</h1><p>Sign in to use AI features, own credits, and manage billing.</p>{error && <p className="auth-error"><CircleAlert size={16} />{error}</p>}{!configured && <p className="auth-error"><CircleAlert size={16} />Supabase browser variables are not configured.</p>}{user ? <a className="public-cta" href={next}>Continue<ArrowRight size={15} /></a> : <button className="google-button" disabled={loading || !configured} onClick={signIn}><GoogleIcon />{loading ? 'Checking session...' : 'Continue with Google'}</button>}<small>By continuing, you agree to the Terms of Service and acknowledge the Privacy Policy.</small></div></main></Page>
}

export function AuthCallbackPage() {
  const [error, setError] = useState<string>()
  const next = safeReturnPath(new URLSearchParams(window.location.search).get('next') || window.sessionStorage.getItem('stranerd.auth.next'))

  useEffect(() => {
    let active = true
    async function complete() {
      if (!supabase) {
        setError('Supabase browser variables are not configured.')
        return
      }
      const params = new URLSearchParams(window.location.search)
      const providerError = params.get('error_description') || params.get('error')
      if (providerError) {
        setError(providerError)
        return
      }
      const code = params.get('code')
      if (!code) {
        setError('The authentication response did not include a code.')
        return
      }
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (!active) return
      if (exchangeError) setError(exchangeError.message)
      else {
        window.sessionStorage.removeItem('stranerd.auth.next')
        window.location.replace(next)
      }
    }
    void complete()
    return () => { active = false }
  }, [next])

  return <Page><main className="status-page"><div><span className="status-mark" /><span className="eyebrow">Secure sign-in</span><h1>{error ? 'Sign-in was not completed.' : 'Completing sign-in.'}</h1><p>{error || 'Confirming your Google session and preparing your account.'}</p>{error && <a className="public-cta" href={`/login?next=${encodeURIComponent(next)}`}>Try again</a>}</div></main></Page>
}

export function AccountPage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const [data, setData] = useState<AccountData>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!user || !supabase) return
    let active = true
    async function loadAccount() {
      const [profile, wallet, transactions, subscription] = await Promise.all([
        supabase!.from('profiles').select('display_name,email,avatar_url').eq('id', user!.id).maybeSingle(),
        supabase!.from('credit_wallets').select('free_balance,subscription_balance,purchased_balance').eq('user_id', user!.id).maybeSingle(),
        supabase!.from('credit_transactions').select('id,amount,type,feature,created_at').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(10),
        supabase!.from('subscriptions').select('status,current_period_end,cancel_at_period_end').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (!active) return
      const firstError = profile.error || wallet.error || transactions.error || subscription.error
      if (firstError) setError(firstError.message)
      else setData({ profile: profile.data, wallet: wallet.data, transactions: transactions.data ?? [], subscription: subscription.data })
    }
    void loadAccount()
    return () => { active = false }
  }, [user])

  if (authLoading) return <Page><main className="status-page"><div><span className="status-mark" /><h1>Loading account.</h1></div></main></Page>
  if (!user) return <Page><main className="status-page"><div><span className="eyebrow">Authentication required</span><h1>Sign in to view your account.</h1><p>Your balance and billing records are private to your Stranerd account.</p><a className="public-cta" href="/login?next=/account">Continue with Google<ArrowRight size={15} /></a></div></main></Page>

  const wallet = data?.wallet
  const total = wallet ? wallet.free_balance + wallet.subscription_balance + wallet.purchased_balance : 0
  const name = data?.profile?.display_name || user.user_metadata.full_name || user.email || 'Stranerd learner'
  const avatar = data?.profile?.avatar_url || user.user_metadata.avatar_url

  return <Page><main className="account-page"><header className="account-heading">{avatar && <img src={avatar} alt="" referrerPolicy="no-referrer" />}<div><span className="eyebrow">Your account</span><h1>{name}</h1><p>{data?.profile?.email || user.email}</p></div><button onClick={() => void signOut()}><LogOut size={16} />Sign out</button></header>{error && <p className="auth-error"><CircleAlert size={16} />{error}</p>}<section className="balance-panel"><div><WalletCards size={20} /><span>Available balance</span><strong>{total}</strong><small>credits</small></div><dl><div><dt>Free</dt><dd>{wallet?.free_balance ?? 0}</dd></div><div><dt>Subscription</dt><dd>{wallet?.subscription_balance ?? 0}</dd></div><div><dt>Purchased</dt><dd>{wallet?.purchased_balance ?? 0}</dd></div></dl></section><section className="account-grid"><article><span className="eyebrow">Plan</span><h2>{data?.subscription?.status === 'active' ? 'Stranerd Plus' : 'Free account'}</h2><p>{data?.subscription?.current_period_end ? `Current period ends ${new Date(data.subscription.current_period_end).toLocaleDateString()}.` : 'Subscribe when you need a larger monthly AI allowance.'}</p><a href="/pricing">View pricing<ArrowRight size={14} /></a></article><article><span className="eyebrow">Account controls</span><h2>Your data</h2><p>Request account deletion through support. Identity and learning data will be handled under the Privacy Policy.</p><a href="mailto:officialstranerd@gmail.com?subject=Stranerd%20account%20deletion%20request">Request deletion<ArrowRight size={14} /></a></article></section><section className="transaction-list"><header><span className="eyebrow">Recent credit activity</span><h2>Transactions</h2></header>{!data && !error && <p>Loading your balance...</p>}{data?.transactions.length === 0 && <p>No credit activity yet.</p>}{data?.transactions.map((transaction) => <div key={transaction.id}><span>{transaction.feature.replace('_', ' ')}</span><b className={transaction.amount > 0 ? 'positive' : ''}>{transaction.amount > 0 ? '+' : ''}{transaction.amount}</b><time>{new Date(transaction.created_at).toLocaleDateString()}</time></div>)}</section></main></Page>
}

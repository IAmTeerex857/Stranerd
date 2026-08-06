import { supabase } from './supabase'

export async function sendWelcomeEmail() {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  if (!data.session) return
  await fetch('/api/email/welcome', {
    method: 'POST',
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  })
}

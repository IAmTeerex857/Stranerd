import type { User } from '@supabase/supabase-js'

export function userFirstName(user?: User | null) {
  const metadata = user?.user_metadata ?? {}
  const name = metadata.full_name || metadata.name || user?.email?.split('@')[0] || 'Learner'
  return String(name).trim().split(/\s+/)[0]
}

export function userAvatar(user?: User | null) {
  return user?.user_metadata.avatar_url || user?.user_metadata.picture || undefined
}

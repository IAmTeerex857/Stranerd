import { supabase } from './supabase'

export type CreditBalance = {
  freeBalance: number
  subscriptionBalance: number
  purchasedBalance: number
}

export class AIActionError extends Error {
  constructor(public code: string, message: string, public status: number, public balance?: CreditBalance) {
    super(message)
  }
}

export async function aiRequest(path: string, body: unknown, signal?: AbortSignal) {
  if (!supabase) throw new AIActionError('authentication_required', 'Sign in to use AI features.', 401)
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new AIActionError('authentication_required', 'Sign in to use AI features.', 401)

  const requestId = crypto.randomUUID()
  let lastError: AIActionError | undefined
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session.access_token}`,
          'X-Request-ID': requestId,
        },
        body: JSON.stringify(body),
        signal,
      })
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string; balance?: CreditBalance }
      if (response.ok) return result
      lastError = new AIActionError(result.error || 'ai_failed', result.message || 'The AI request could not be completed.', response.status, result.balance)
      if (!['request_in_progress', 'credit_finalization_pending'].includes(lastError.code) || attempt === 4) throw lastError
    } catch (error) {
      if (signal?.aborted) throw new AIActionError('request_timed_out', 'The AI request timed out. Any reserved credit will be recovered automatically.', 504)
      if (error instanceof AIActionError && !['request_in_progress', 'credit_finalization_pending'].includes(error.code)) throw error
      lastError = error instanceof AIActionError ? error : new AIActionError('network_error', 'The AI response was interrupted. Retrying safely.', 503)
      if (attempt === 4) throw lastError
    }
    await new Promise((resolve) => window.setTimeout(resolve, 1_500))
  }
  throw lastError || new AIActionError('ai_failed', 'The AI request could not be completed.', 500)
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'

export type CreditBalance = {
  freeBalance: number
  subscriptionBalance: number
  purchasedBalance: number
}

type ReservationResult = CreditBalance & {
  reservationId: string
  requestId: string
  status: string
}

type ProtectedOperation<T> = () => Promise<{ value: T; source: string; successful: boolean }>

type ProtectedInput = {
  authorization?: string
  requestId?: string
  feature: 'mentor' | 'ai_quiz'
  provider: string
  model?: string
  clientIp?: string
}

export class AiRequestError extends Error {
  constructor(public status: number, public code: string, message: string, public balance?: CreditBalance) {
    super(message)
  }
}

let serviceClient: SupabaseClient | undefined

export function setAiCreditClientForTests(client?: SupabaseClient) {
  serviceClient = client
}

function getServiceClient() {
  if (serviceClient) return serviceClient
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new AiRequestError(503, 'server_not_configured', 'AI account services are not configured.')
  serviceClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return serviceClient
}

export function configuredAiProvider() {
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_DEPLOYMENT) return 'azure-openai'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return 'unavailable'
}

function bearerToken(authorization?: string) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  if (!match) throw new AiRequestError(401, 'authentication_required', 'Sign in to use AI features.')
  return match[1]
}

function validRequestId(value?: string) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

async function refund(client: SupabaseClient, userId: string, requestId: string) {
  const { data, error } = await client.rpc('refund_credit_reservation', { p_user_id: userId, p_request_id: requestId })
  if (error) throw new AiRequestError(500, 'credit_refund_failed', 'The AI request failed and its credit is pending automatic recovery.')
  return data as ReservationResult
}

async function finalize(client: SupabaseClient, userId: string, requestId: string) {
  let result = await client.rpc('finalize_credit_reservation', { p_user_id: userId, p_request_id: requestId })
  if (result.error) result = await client.rpc('finalize_credit_reservation', { p_user_id: userId, p_request_id: requestId })
  if (result.error) throw new AiRequestError(503, 'credit_finalization_pending', 'The AI result is awaiting credit reconciliation. Retry this request shortly.')
  return result.data as ReservationResult
}

async function updateUsage(client: SupabaseClient, requestId: string, values: Record<string, unknown>) {
  let result = await client.from('ai_usage').update(values).eq('request_id', requestId)
  if (result.error) result = await client.from('ai_usage').update(values).eq('request_id', requestId)
  return result.error
}

export async function runCreditProtected<T>(input: ProtectedInput, operation: ProtectedOperation<T>) {
  if (!validRequestId(input.requestId)) throw new AiRequestError(400, 'invalid_request_id', 'A valid request ID is required.')
  const token = bearerToken(input.authorization)
  const client = getServiceClient()
  const { data: auth, error: authError } = await client.auth.getUser(token)
  if (authError || !auth.user) throw new AiRequestError(401, 'invalid_session', 'Your session is invalid or expired.')

  const ipHash = input.clientIp
    ? createHmac('sha256', process.env.RATE_LIMIT_HASH_SECRET || process.env.SUPABASE_SECRET_KEY!).update(input.clientIp).digest('hex')
    : null
  const { data: allowed, error: limitError } = await client.rpc('check_ai_rate_limits', {
    p_user_key: `ai:user:${auth.user.id}`,
    p_user_limit: 10,
    p_ip_key: ipHash ? `ai:ip:${ipHash}` : null,
    p_ip_limit: 30,
    p_window_seconds: 60,
  })
  if (limitError) throw new AiRequestError(503, 'rate_limit_unavailable', 'AI request limits could not be verified.')
  if (!allowed) throw new AiRequestError(429, 'rate_limited', 'Too many AI requests. Please wait and try again.')

  const { data: existingUsage, error: existingError } = await client
    .from('ai_usage')
    .select('status,metadata')
    .eq('request_id', input.requestId!)
    .maybeSingle()
  if (existingError) throw new AiRequestError(500, 'usage_lookup_failed', 'AI usage could not be verified.')
  if (existingUsage) {
    const metadata = existingUsage.metadata as { source?: string; response?: T; pendingResponse?: T } | null
    if (existingUsage.status === 'successful' && metadata?.response !== undefined) {
      const { data: replayBalance, error: replayError } = await client.rpc('reserve_credits', { p_user_id: auth.user.id, p_feature: input.feature, p_amount: 1, p_request_id: input.requestId })
      if (replayError) throw new AiRequestError(500, 'replay_failed', 'The completed AI request could not be replayed.')
      return { value: metadata.response, source: metadata.source || input.provider, balance: replayBalance as ReservationResult }
    }
    if (existingUsage.status === 'requested' && metadata?.pendingResponse !== undefined) {
      const replayBalance = await finalize(client, auth.user.id, input.requestId!)
      const updateError = await updateUsage(client, input.requestId!, { status: 'successful', completed_at: new Date().toISOString(), metadata: { source: metadata.source || input.provider, response: metadata.pendingResponse } })
      if (updateError) console.error('AI usage replay update failed:', updateError.message)
      return { value: metadata.pendingResponse, source: metadata.source || input.provider, balance: replayBalance }
    }
    throw new AiRequestError(409, 'request_in_progress', `This AI request is already ${existingUsage.status}.`)
  }

  const { data: reserved, error: reserveError } = await client.rpc('reserve_credits', {
    p_user_id: auth.user.id,
    p_feature: input.feature,
    p_amount: 1,
    p_request_id: input.requestId,
  })
  if (reserveError) {
    if (reserveError.message.toLowerCase().includes('insufficient credits')) throw new AiRequestError(402, 'insufficient_credits', 'You do not have enough credits for this AI request.')
    throw new AiRequestError(500, 'credit_reservation_failed', 'A credit could not be reserved.')
  }
  const reservation = reserved as ReservationResult

  const { error: usageError } = await client.from('ai_usage').insert({
    user_id: auth.user.id,
    feature: input.feature,
    request_id: input.requestId,
    reservation_id: reservation.reservationId,
    provider: input.provider,
    model: input.model,
    status: 'requested',
  })
  if (usageError) {
    if (usageError.code !== '23505') await refund(client, auth.user.id, input.requestId!)
    throw new AiRequestError(usageError.code === '23505' ? 409 : 500, usageError.code === '23505' ? 'duplicate_request' : 'usage_record_failed', 'The AI request could not be started.')
  }

  let result: Awaited<ReturnType<ProtectedOperation<T>>>
  try {
    result = await operation()
  } catch (error) {
    const refunded = await refund(client, auth.user.id, input.requestId!)
    const updateError = await updateUsage(client, input.requestId!, { status: 'failed', completed_at: new Date().toISOString(), metadata: { reason: error instanceof Error ? error.name : 'provider_error' } })
    if (updateError) console.error('AI usage failure update failed:', updateError.message)
    throw new AiRequestError(502, 'ai_failed', 'The AI provider could not complete this request. No credit was charged.', refunded)
  }

  if (!result.successful) {
    const refunded = await refund(client, auth.user.id, input.requestId!)
    const updateError = await updateUsage(client, input.requestId!, { status: 'failed', completed_at: new Date().toISOString(), metadata: { reason: result.source } })
    if (updateError) console.error('AI usage invalid-response update failed:', updateError.message)
    throw new AiRequestError(503, 'ai_unavailable', 'The AI provider did not return a valid response. No credit was charged.', refunded)
  }

  const pendingError = await updateUsage(client, input.requestId!, { metadata: { source: result.source, pendingResponse: result.value } })
  if (pendingError) {
    const refunded = await refund(client, auth.user.id, input.requestId!)
    throw new AiRequestError(500, 'usage_record_failed', 'The AI result could not be recorded. No credit was charged.', refunded)
  }
  const finalized = await finalize(client, auth.user.id, input.requestId!)
  const completionError = await updateUsage(client, input.requestId!, { status: 'successful', completed_at: new Date().toISOString(), metadata: { source: result.source, response: result.value } })
  if (completionError) console.error('AI usage completion update failed:', completionError.message)
  return { value: result.value, source: result.source, balance: finalized }
}

export function aiErrorResponse(error: unknown) {
  if (error instanceof AiRequestError) return { status: error.status, body: { error: error.code, message: error.message, balance: error.balance } }
  console.error('Protected AI request failed:', error instanceof Error ? error.message : error)
  return { status: 500, body: { error: 'internal_error', message: 'The AI request could not be completed.' } }
}

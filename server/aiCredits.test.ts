import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AiRequestError, runCreditProtected, setAiCreditClientForTests } from './aiCredits.js'

const requestId = '123e4567-e89b-42d3-a456-426614174000'
const reservation = { reservationId: 'reservation-1', requestId, status: 'reserved', freeBalance: 19, subscriptionBalance: 0, purchasedBalance: 0 }

function fakeClient(options: { existing?: { status: string; metadata?: Record<string, unknown> }; reserveError?: string } = {}) {
  const updates: unknown[] = []
  const inserts: unknown[] = []
  const rpc = vi.fn(async (name: string) => {
    if (name === 'check_ai_rate_limits') return { data: true, error: null }
    if (name === 'reserve_credits' && options.reserveError) return { data: null, error: { message: options.reserveError } }
    if (name === 'finalize_credit_reservation') return { data: { ...reservation, status: 'spent' }, error: null }
    if (name === 'refund_credit_reservation') return { data: { ...reservation, status: 'refunded', freeBalance: 20 }, error: null }
    return { data: reservation, error: null }
  })
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    rpc,
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: options.existing ?? null, error: null }) }) }),
      insert: async (value: unknown) => { inserts.push(value); return { error: null } },
      update: (value: unknown) => ({ eq: async () => { updates.push(value); return { error: null } } }),
    })),
  } as unknown as SupabaseClient
  return { client, rpc, updates, inserts }
}

afterEach(() => setAiCreditClientForTests(undefined))

describe('runCreditProtected', () => {
  it('rejects requests without a bearer token before charging', async () => {
    await expect(runCreditProtected({ requestId, feature: 'mentor', provider: 'openai' }, async () => ({ value: 'unused', source: 'openai', successful: true })))
      .rejects.toMatchObject({ status: 401, code: 'authentication_required' })
  })

  it('reserves, records, and finalizes one successful request', async () => {
    const fake = fakeClient()
    setAiCreditClientForTests(fake.client)
    const result = await runCreditProtected({ authorization: 'Bearer token', requestId, feature: 'mentor', provider: 'openai' }, async () => ({ value: 'answer', source: 'openai', successful: true }))
    expect(result.value).toBe('answer')
    expect(result.balance.status).toBe('spent')
    expect(fake.rpc.mock.calls.map(([name]) => name)).toEqual(['check_ai_rate_limits', 'reserve_credits', 'finalize_credit_reservation'])
    expect(fake.inserts).toHaveLength(1)
    expect(fake.updates).toContainEqual(expect.objectContaining({ status: 'successful' }))
  })

  it('reserves the server-selected number of credits', async () => {
    const fake = fakeClient()
    setAiCreditClientForTests(fake.client)
    await runCreditProtected({ authorization: 'Bearer token', requestId, feature: 'ai_quiz', amount: 5, provider: 'openai' }, async () => ({ value: 'assessment', source: 'openai', successful: true }))
    expect(fake.rpc).toHaveBeenCalledWith('reserve_credits', expect.objectContaining({ p_amount: 5 }))
  })

  it('refunds an invalid provider response', async () => {
    const fake = fakeClient()
    setAiCreditClientForTests(fake.client)
    await expect(runCreditProtected({ authorization: 'Bearer token', requestId, feature: 'ai_quiz', provider: 'openai' }, async () => ({ value: null, source: 'invalid-ai-response', successful: false })))
      .rejects.toMatchObject({ status: 503, code: 'ai_unavailable', balance: expect.objectContaining({ freeBalance: 20 }) })
    expect(fake.rpc.mock.calls.map(([name]) => name)).toEqual(['check_ai_rate_limits', 'reserve_credits', 'refund_credit_reservation'])
    expect(fake.updates).toContainEqual(expect.objectContaining({ status: 'failed' }))
  })

  it('returns insufficient credit without running the provider', async () => {
    const fake = fakeClient({ reserveError: 'insufficient credits' })
    const operation = vi.fn(async () => ({ value: 'answer', source: 'openai', successful: true }))
    setAiCreditClientForTests(fake.client)
    await expect(runCreditProtected({ authorization: 'Bearer token', requestId, feature: 'mentor', provider: 'openai' }, operation))
      .rejects.toMatchObject({ status: 402, code: 'insufficient_credits' })
    expect(operation).not.toHaveBeenCalled()
  })

  it('rejects a repeated usage request without another reservation', async () => {
    const fake = fakeClient({ existing: { status: 'successful' } })
    setAiCreditClientForTests(fake.client)
    await expect(runCreditProtected({ authorization: 'Bearer token', requestId, feature: 'mentor', provider: 'openai' }, async () => ({ value: 'answer', source: 'openai', successful: true })))
      .rejects.toBeInstanceOf(AiRequestError)
    expect(fake.rpc.mock.calls.some(([name]) => name === 'reserve_credits')).toBe(false)
  })

  it('replays a completed response without spending again', async () => {
    const fake = fakeClient({ existing: { status: 'successful', metadata: { source: 'openai', response: 'saved answer' } } })
    setAiCreditClientForTests(fake.client)
    const result = await runCreditProtected({ authorization: 'Bearer token', requestId, feature: 'mentor', provider: 'openai' }, async () => ({ value: 'new answer', source: 'openai', successful: true }))
    expect(result.value).toBe('saved answer')
    expect(fake.rpc.mock.calls.filter(([name]) => name === 'reserve_credits')).toHaveLength(1)
    expect(fake.rpc.mock.calls.some(([name]) => name === 'finalize_credit_reservation')).toBe(false)
  })
})

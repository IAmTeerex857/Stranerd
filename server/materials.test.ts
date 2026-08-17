import { afterEach, describe, expect, it, vi } from 'vitest'
import { setAiCreditClientForTests } from './aiCredits.js'
import { getMaterialNotes, getMaterialQuestions, gradeMaterialQuestions, materialsErrorResponse } from './materials.js'

const releaseId = '123e4567-e89b-42d3-a456-426614174000'

function query(data: unknown, error: unknown = null) {
  const value = { data, error }
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'limit', 'range']) chain[method] = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => value)
  chain.then = (resolve: (result: typeof value) => unknown, reject: (cause: unknown) => unknown) => Promise.resolve(value).then(resolve, reject)
  return chain
}

function clientFor(tables: Record<string, ReturnType<typeof query>>, signedUrls?: (paths: string[]) => unknown) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })) },
    from: vi.fn((table: string) => tables[table]),
    storage: { from: vi.fn(() => ({ createSignedUrls: vi.fn(async (paths: string[]) => ({ data: signedUrls?.(paths) ?? [], error: null })) })) },
  }
}

afterEach(() => setAiCreditClientForTests())

describe('secured materials service', () => {
  it('requires a verified bearer session', async () => {
    const client = clientFor({ material_releases: query({ id: releaseId }) })
    client.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'expired' } } as never)
    setAiCreditClientForTests(client as never)
    const result = await getMaterialQuestions('Bearer expired', releaseId).catch(materialsErrorResponse)
    expect(result).toEqual({ status: 401, body: { error: 'authentication_required', message: 'Sign in to access learning materials.' } })
  })

  it('does not select or return answers and explanations before submission', async () => {
    const questions = query([{ stable_id: 'q1', ordinal: 0, question: 'Question?', options: { A: 'A', B: 'B', C: 'C', D: 'D' }, chapter: 'One', section: 'Basics' }])
    const client = clientFor({ material_releases: query({ id: releaseId }), material_questions: questions })
    setAiCreditClientForTests(client as never)
    const result = await getMaterialQuestions('Bearer valid', releaseId)
    expect(questions.select).toHaveBeenCalledWith('stable_id,ordinal,question,options,chapter,section')
    expect(JSON.stringify(result)).not.toMatch(/answer|explanation/)
  })

  it('grades a complete deck server-side and returns answers after submission', async () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({ stable_id: `q${index}`, ordinal: index, options: { A: 'A', B: 'B', C: 'C', D: 'D' }, answer: index % 2 ? 'B' : 'A', explanation: `Explanation ${index}` }))
    const client = clientFor({ material_releases: query({ id: releaseId }), material_questions: query(rows) })
    setAiCreditClientForTests(client as never)
    const answers = Object.fromEntries(rows.map((row) => [row.stable_id, row.answer === 'A' ? 0 : 1]))
    const result = await gradeMaterialQuestions('Bearer valid', releaseId, answers)
    expect(result.score).toBe(20)
    expect(result.results[1]).toEqual({ id: 'q1', answerIndex: 1, explanation: 'Explanation 1' })
  })

  it('replaces stored public asset references with short-lived signed URLs', async () => {
    const publicUrl = 'https://project.supabase.co/storage/v1/object/public/materials/original.png'
    const derivativeUrl = 'https://project.supabase.co/storage/v1/object/public/materials/480.webp'
    const client = clientFor({
      material_releases: query({ id: releaseId }),
      material_sections: query([{ stable_id: 's1', ordinal: 0, title: 'Notes', heading_path: [], content: `![Diagram](${publicUrl})`, source_page_start: 1, source_page_end: 1 }]),
      material_mnemonics: query([{ stable_id: 'm1', ordinal: 0, title: 'Mnemonic', body: `See ${derivativeUrl}`, section: null, source_page: 1 }]),
      material_assets: query([{ public_url: publicUrl, storage_path: 'original.png', metadata: { width: 1000, height: 500, derivatives: [{ publicUrl: derivativeUrl, storagePath: '480.webp', width: 480 }] } }]),
    }, (paths) => paths.map((path) => ({ path, signedUrl: `https://signed.test/${path}?token=short-lived` })))
    setAiCreditClientForTests(client as never)
    const result = await getMaterialNotes('Bearer valid', releaseId)
    expect(JSON.stringify(result)).not.toContain('/object/public/materials')
    expect(result.sections[0].content).toContain('token=short-lived')
    expect(result.assets[0].srcSet).toContain('480w')
  })

  it('replaces legacy asset URLs even when responsive dimensions are missing', async () => {
    const publicUrl = 'https://project.supabase.co/storage/v1/object/public/materials/legacy.png'
    const client = clientFor({
      material_releases: query({ id: releaseId }),
      material_sections: query([{ stable_id: 's1', ordinal: 0, title: 'Notes', heading_path: [], content: `![Diagram](${publicUrl})`, source_page_start: 1, source_page_end: 1 }]),
      material_mnemonics: query([]),
      material_assets: query([{ public_url: publicUrl, storage_path: 'legacy.png', metadata: {} }]),
    }, (paths) => paths.map((path) => ({ path, signedUrl: `https://signed.test/${path}?token=short-lived` })))
    setAiCreditClientForTests(client as never)
    const result = await getMaterialNotes('Bearer valid', releaseId)
    expect(result.sections[0].content).toContain('https://signed.test/legacy.png?token=short-lived')
    expect(result.sections[0].content).not.toContain('/object/public/materials')
    expect(result.assets).toEqual([])
  })
})

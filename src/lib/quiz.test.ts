import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aiRequest } from './ai'
import { generateMaterialFlashcardHint, generateMaterialQuestionHint } from './quiz'
import type { MaterialFlashcard, MaterialQuestion, MaterialSubject } from '../types/materials'

vi.mock('./ai', () => ({ aiRequest: vi.fn() }))

const balance = { freeBalance: 1, subscriptionBalance: 2, purchasedBalance: 3 }
const subject: MaterialSubject = { id: 's1', slug: 'anatomy', title: 'Anatomy', releaseId: 'r1', contentVersion: 'v1', publishedAt: null, counts: { sections: 0, mnemonics: 0, flashcards: 1, questions: 20 } }

describe('material AI assessment clients', () => {
  beforeEach(() => {
    vi.mocked(aiRequest).mockReset().mockResolvedValue({ hint: 'Consider the relationship.', balance } as never)
    vi.stubGlobal('window', { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout })
  })

  it('omits the authored answer and explanation from question hint requests', async () => {
    const question: MaterialQuestion = { id: 'q1', ordinal: 0, question: 'Which structure?', options: ['A', 'B', 'C', 'D'], answerIndex: 2, explanation: 'C is correct.', chapter: 'One', section: 'Intro' }
    await generateMaterialQuestionHint(subject, question)
    const body = vi.mocked(aiRequest).mock.calls[0][1] as Record<string, unknown>
    expect(body.quiz).toEqual({ id: 'q1', question: question.question, options: question.options })
    expect(JSON.stringify(body)).not.toContain('answerIndex')
    expect(JSON.stringify(body)).not.toContain('C is correct')
  })

  it('sends only the question side when requesting a flashcard hint', async () => {
    const card: MaterialFlashcard = { id: 'c1', ordinal: 0, type: 'basic', front: 'Name this structure.', back: 'Secret answer', section: null, tags: [] }
    await generateMaterialFlashcardHint(subject, card)
    const body = vi.mocked(aiRequest).mock.calls[0][1] as Record<string, unknown>
    expect(body.quiz).toEqual({ id: 'c1', question: card.front, options: [] })
    expect(JSON.stringify(body)).not.toContain(card.back)
  })
})

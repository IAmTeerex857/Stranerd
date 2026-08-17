import { afterEach, describe, expect, it, vi } from 'vitest'
import { setAiCreditClientForTests } from './aiCredits.js'
import { getProtectedAssessment, getProtectedBuiltInDeck, getProtectedLabActivity, gradeProtectedAssessment, gradeProtectedLabQuestion, learningErrorResponse } from './learning.js'

function authenticatedClient(valid = true) {
  return { auth: { getUser: vi.fn(async () => valid ? { data: { user: { id: 'user-1' } }, error: null } : { data: { user: null }, error: { message: 'expired' } }) } }
}

afterEach(() => setAiCreditClientForTests())

describe('protected learning content', () => {
  it('requires a verified session', async () => {
    setAiCreditClientForTests(authenticatedClient(false) as never)
    const result = await getProtectedLabActivity('Bearer expired', 'heart-flow').catch(learningErrorResponse)
    expect(result).toEqual({ status: 401, body: { error: 'authentication_required', message: 'Sign in to access this learning activity.' } })
  })

  it('does not return Lab answer keys before a question is checked', async () => {
    setAiCreditClientForTests(authenticatedClient() as never)
    const result = await getProtectedLabActivity('Bearer valid', 'heart-flow')
    const question = result.activity.steps.find((step) => step.kind === 'question')!
    expect(question).not.toHaveProperty('correctIndex')
    expect(question).not.toHaveProperty('explanation')
    await expect(gradeProtectedLabQuestion('Bearer valid', { activityId: 'heart-flow', stepIndex: 1, choice: 0 })).resolves.toMatchObject({ correct: true, explanation: expect.any(String) })
  })

  it('keeps assessment answers server-side until submission', async () => {
    setAiCreditClientForTests(authenticatedClient() as never)
    const initial = await getProtectedAssessment('Bearer valid', { modelId: 'heart', seed: 123 })
    expect(initial.quizzes).toHaveLength(20)
    expect(initial.quizzes.every((quiz) => quiz.correctIndex === -1 && quiz.explanation === '')).toBe(true)
    const fullAnswers = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index, 0]))
    const graded = await gradeProtectedAssessment('Bearer valid', { modelId: 'heart', seed: 123, answers: fullAnswers })
    expect(graded.quizzes).toHaveLength(20)
    expect(graded.quizzes.every((quiz) => quiz.correctIndex >= 0 && quiz.explanation.length > 0)).toBe(true)
  })

  it('serves complete built-in flashcard decks only after authentication', async () => {
    setAiCreditClientForTests(authenticatedClient() as never)
    const result = await getProtectedBuiltInDeck('Bearer valid', 'heart-foundations')
    expect(result.deck.cards).toHaveLength(15)
    expect(result.deck.cards[0].back.heading).toBeTruthy()
  })
})

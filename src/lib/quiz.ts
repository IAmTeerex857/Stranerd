import type { ModelEntry, Quiz } from '../types'
import { aiRequest, type CreditBalance } from './ai'

function validQuiz(value: unknown): value is Quiz {
  if (!value || typeof value !== 'object') return false
  const quiz = value as Quiz
  return typeof quiz.id === 'string'
    && typeof quiz.question === 'string'
    && quiz.question.length > 0
    && Array.isArray(quiz.options)
    && quiz.options.length === 4
    && new Set(quiz.options).size === 4
    && Number.isInteger(quiz.correctIndex)
    && quiz.correctIndex >= 0
    && quiz.correctIndex < 4
    && typeof quiz.explanation === 'string'
}

export async function generateAIQuiz(model: ModelEntry, previousQuestions: string[]): Promise<{ quizzes: Quiz[]; balance: CreditBalance }> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 50_000)
  try {
    const data = await aiRequest('/api/quiz', {
      modelId: model.id,
      model: model.name,
      system: model.system,
      description: model.description,
      facts: model.facts,
      structures: model.hotspots.map((hotspot) => ({ label: hotspot.label, detail: hotspot.detail })),
      previousQuestions,
    }, controller.signal) as { quizzes?: unknown; balance?: CreditBalance }
    if (!Array.isArray(data.quizzes) || data.quizzes.length !== 20 || !data.quizzes.every(validQuiz) || !data.balance) throw new Error('AI quiz response was incomplete.')
    return { quizzes: data.quizzes, balance: data.balance }
  } finally {
    window.clearTimeout(timeout)
  }
}

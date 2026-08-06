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

async function assessmentRequest(model: ModelEntry, body: Record<string, unknown>) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 50_000)
  try {
    return await aiRequest('/api/quiz', {
      modelId: model.id,
      model: model.name,
      system: model.system,
      description: model.description,
      facts: model.facts,
      structures: model.hotspots.map((hotspot) => ({ label: hotspot.label, detail: hotspot.detail })),
      ...body,
    }, controller.signal)
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function generateAIQuiz(model: ModelEntry, previousQuestions: string[]): Promise<{ quizzes: Quiz[]; balance: CreditBalance }> {
  const data = await assessmentRequest(model, { action: 'generate', previousQuestions }) as { quizzes?: unknown; balance?: CreditBalance }
  if (!Array.isArray(data.quizzes) || data.quizzes.length !== 20 || !data.quizzes.every(validQuiz) || !data.balance) throw new Error('AI assessment response was incomplete.')
  return { quizzes: data.quizzes, balance: data.balance }
}

export async function generateAIHint(model: ModelEntry, quiz: Quiz): Promise<{ hint: string; balance: CreditBalance }> {
  const data = await assessmentRequest(model, { action: 'hint', quiz }) as { hint?: unknown; balance?: CreditBalance }
  if (typeof data.hint !== 'string' || !data.hint.trim() || !data.balance) throw new Error('AI hint response was incomplete.')
  return { hint: data.hint.trim(), balance: data.balance }
}

export async function generateAICorrections(model: ModelEntry, quizzes: Quiz[], answers: (number | null)[]): Promise<{ corrections: string[]; balance: CreditBalance }> {
  const data = await assessmentRequest(model, { action: 'corrections', quizzes, answers }) as { corrections?: unknown; balance?: CreditBalance }
  if (!Array.isArray(data.corrections) || data.corrections.length !== 20 || !data.corrections.every((item) => typeof item === 'string' && item.trim()) || !data.balance) {
    throw new Error('AI correction response was incomplete.')
  }
  return { corrections: data.corrections as string[], balance: data.balance }
}

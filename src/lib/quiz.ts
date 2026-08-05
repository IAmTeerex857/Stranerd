import type { ModelEntry, Quiz } from '../types'

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

export async function generateAIQuiz(model: ModelEntry, previousQuestions: string[], fallback: Quiz[]) {
  try {
    const response = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelId: model.id,
        model: model.name,
        system: model.system,
        description: model.description,
        facts: model.facts,
        structures: model.hotspots.map((hotspot) => ({ label: hotspot.label, detail: hotspot.detail })),
        previousQuestions,
      }),
    })
    if (!response.ok) throw new Error(`Quiz request returned ${response.status}`)
    const data = await response.json() as { quizzes?: unknown }
    return Array.isArray(data.quizzes) && data.quizzes.length === 20 && data.quizzes.every(validQuiz) ? data.quizzes : fallback
  } catch {
    return fallback
  }
}

import { describe, expect, it } from 'vitest'
import { models } from './models'
import { evaluateQuiz, quizzes, quizzesByModel } from './quizzes'

describe('deterministic knowledge quizzes', () => {
  it('provides exactly one valid authored quiz per model', () => {
    expect(quizzes).toHaveLength(models.length)
    for (const model of models) {
      const quiz = quizzesByModel[model.id]
      expect(quiz.modelId).toBe(model.id)
      expect(quiz.options.length).toBeGreaterThanOrEqual(3)
      expect(quiz.options.length).toBeLessThanOrEqual(4)
      expect(quiz.correctIndex).toBeGreaterThanOrEqual(0)
      expect(quiz.correctIndex).toBeLessThan(quiz.options.length)
      expect(quiz.explanation.length).toBeGreaterThan(0)
    }
  })

  it('grades only the authored correct index', () => {
    for (const quiz of quizzes) {
      expect(evaluateQuiz(quiz, quiz.correctIndex).pass).toBe(true)
      expect(evaluateQuiz(quiz, (quiz.correctIndex + 1) % quiz.options.length).pass).toBe(false)
    }
  })
})

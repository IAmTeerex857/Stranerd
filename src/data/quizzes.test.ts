import { describe, expect, it } from 'vitest'
import { models } from './models'
import { allQuizzes, evaluateQuiz, quizzesForModel } from './quizzes'

describe('deterministic knowledge quizzes', () => {
  it('provides 20 MCQ and true-false quizzes for every model', () => {
    expect(allQuizzes).toHaveLength(models.length * 20)
    for (const model of models) {
      const quizzes = quizzesForModel(model.id)
      expect(quizzes).toHaveLength(20)
      expect(new Set(quizzes.map((quiz) => quiz.kind))).toEqual(new Set(['multiple-choice', 'true-false']))
      for (const quiz of quizzes) {
        expect(quiz.modelId).toBe(model.id)
        expect(quiz.options.length).toBeGreaterThanOrEqual(2)
        expect(quiz.correctIndex).toBeGreaterThanOrEqual(0)
        expect(quiz.correctIndex).toBeLessThan(quiz.options.length)
        expect(quiz.explanation.length).toBeGreaterThan(0)
      }
    }
  })

  it('grades only the authored correct index', () => {
    for (const quiz of allQuizzes) {
      expect(evaluateQuiz(quiz, quiz.correctIndex).pass).toBe(true)
      expect(evaluateQuiz(quiz, (quiz.correctIndex + 1) % quiz.options.length).pass).toBe(false)
    }
  })
})

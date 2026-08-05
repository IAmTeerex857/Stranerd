import { describe, expect, it } from 'vitest'
import { models } from './models'
import { allQuizzes, evaluateQuiz, quizzesForModel } from './quizzes'

describe('session-generated knowledge quizzes', () => {
  it('provides 20 four-option multiple-choice quizzes for every model', () => {
    expect(allQuizzes).toHaveLength(models.length * 20)
    for (const model of models) {
      const quizzes = quizzesForModel(model.id)
      expect(quizzes).toHaveLength(20)
      expect(new Set(quizzes.map((quiz) => quiz.kind))).toEqual(new Set(['multiple-choice']))
      for (const quiz of quizzes) {
        expect(quiz.modelId).toBe(model.id)
        expect(quiz.options).toHaveLength(4)
        expect(new Set(quiz.options).size).toBe(4)
        expect(quiz.correctIndex).toBeGreaterThanOrEqual(0)
        expect(quiz.correctIndex).toBeLessThan(quiz.options.length)
        expect(quiz.explanation.length).toBeGreaterThan(0)
      }
    }
  })

  it('varies question order and options between session seeds', () => {
    const first = quizzesForModel('heart', 123)
    const second = quizzesForModel('heart', 987)
    expect(first.map((quiz) => `${quiz.question}|${quiz.options.join(',')}`)).not.toEqual(second.map((quiz) => `${quiz.question}|${quiz.options.join(',')}`))
  })

  it('grades only the authored correct index', () => {
    for (const quiz of allQuizzes) {
      expect(evaluateQuiz(quiz, quiz.correctIndex).pass).toBe(true)
      expect(evaluateQuiz(quiz, (quiz.correctIndex + 1) % quiz.options.length).pass).toBe(false)
    }
  })
})

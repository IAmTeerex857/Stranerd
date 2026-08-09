import { describe, expect, it } from 'vitest'
import { models } from './models'
import { allQuizzes, assessmentProgressForModel, defaultQuizIdsForModel, evaluateQuiz, quizzesForModel } from './quizzes'

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

  it('reports progress from unique default question IDs only', () => {
    const ids = defaultQuizIdsForModel('heart')
    expect(ids).toHaveLength(20)
    expect(assessmentProgressForModel('heart', [])).toMatchObject({ completed: 0, total: 20, status: 'not-started' })
    expect(assessmentProgressForModel('heart', [ids[0], ids[0], 'ai-generated'])).toMatchObject({ completed: 1, status: 'in-progress' })
    expect(assessmentProgressForModel('heart', ids)).toMatchObject({ completed: 20, status: 'complete' })
  })
})

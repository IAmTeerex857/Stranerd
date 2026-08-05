import { describe, expect, it } from 'vitest'
import { parseQuizSet } from './quiz.js'

describe('AI quiz validation', () => {
  it('accepts exactly 20 valid four-option questions', () => {
    const payload = JSON.stringify({ quizzes: Array.from({ length: 20 }, (_, index) => ({
      question: `Question ${index + 1}?`,
      options: ['A', 'B', 'C', 'D'].map((option) => `${option}${index}`),
      correctIndex: index % 4,
      explanation: `Explanation ${index + 1}`,
    })) })
    const quizzes = parseQuizSet(payload, 'heart')
    expect(quizzes).toHaveLength(20)
    expect(quizzes?.every((quiz) => quiz.options.length === 4 && new Set(quiz.options).size === 4)).toBe(true)
  })

  it('rejects incomplete, duplicated, or malformed answer sets', () => {
    expect(parseQuizSet(JSON.stringify({ quizzes: [] }), 'heart')).toBeUndefined()
    const malformed = JSON.stringify({ quizzes: Array.from({ length: 20 }, () => ({ question: 'Question?', options: ['A', 'A', 'C', 'D'], correctIndex: 0, explanation: 'Explanation' })) })
    expect(parseQuizSet(malformed, 'heart')).toBeUndefined()
  })
})

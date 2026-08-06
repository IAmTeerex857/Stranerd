import { describe, expect, it } from 'vitest'
import { parseQuizCorrections, parseQuizHint, parseQuizSet } from './quiz.js'

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

  it('accepts only a non-empty hint', () => {
    expect(parseQuizHint(JSON.stringify({ hint: 'Think about when ventricular pressure is lowest.' }))).toContain('ventricular pressure')
    expect(parseQuizHint(JSON.stringify({ hint: '' }))).toBeUndefined()
    expect(parseQuizHint('not json')).toBeUndefined()
  })

  it('requires exactly 20 non-empty corrections', () => {
    const corrections = Array.from({ length: 20 }, (_, index) => `Correction ${index + 1}`)
    expect(parseQuizCorrections(JSON.stringify({ corrections }))).toEqual(corrections)
    expect(parseQuizCorrections(JSON.stringify({ corrections: corrections.slice(1) }))).toBeUndefined()
    expect(parseQuizCorrections(JSON.stringify({ corrections: [...corrections.slice(1), ''] }))).toBeUndefined()
  })

  it('rejects incomplete, duplicated, or malformed answer sets', () => {
    expect(parseQuizSet(JSON.stringify({ quizzes: [] }), 'heart')).toBeUndefined()
    const malformed = JSON.stringify({ quizzes: Array.from({ length: 20 }, () => ({ question: 'Question?', options: ['A', 'A', 'C', 'D'], correctIndex: 0, explanation: 'Explanation' })) })
    expect(parseQuizSet(malformed, 'heart')).toBeUndefined()
  })
})

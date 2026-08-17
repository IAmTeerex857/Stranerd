import { describe, expect, it } from 'vitest'
import { PermanentJobError } from './errors.js'
import { generationSystemPrompt } from './ai.js'
import { isTerminalAttempt } from './processor.js'
import { batches, generationCredits, isPrivateAddress, parseQueueMessage, validateGeneratedItems } from './validation.js'

describe('library worker validation', () => {
  it('validates task payloads', () => {
    const id = '8f93ec0d-876e-4a40-a05e-b66cbe9d9b0a'
    expect(parseQueueMessage({ jobId: id })).toEqual({ jobId: id })
    expect(parseQueueMessage(JSON.stringify({ jobId: id }))).toEqual({ jobId: id })
    expect(parseQueueMessage({ jobId: '../bad' })).toBeUndefined()
  })

  it('prices and batches generation', () => {
    expect(generationCredits(1)).toBe(5)
    expect(generationCredits(11)).toBe(10)
    expect(batches(25)).toEqual([10, 10, 5])
    expect(() => generationCredits(101)).toThrow()
  })

  it('blocks private and special network addresses', () => {
    for (const address of ['127.0.0.1', '10.2.3.4', '172.16.0.1', '192.168.1.2', '169.254.1.1', '::1', 'fd00::1', 'fe80::1', '::ffff:7f00:1', 'ff02::1']) expect(isPrivateAddress(address)).toBe(true)
    expect(isPrivateAddress('8.8.8.8')).toBe(false)
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false)
  })

  it('validates generated questions', () => {
    const item = { kind: 'question', prompt: 'Question?', answer: 'A', explanation: 'Because.', options: ['A', 'B', 'C', 'D'], tags: ['topic'] }
    expect(validateGeneratedItems({ items: [item] }, 1, 'question')).toEqual([item])
    expect(validateGeneratedItems({ items: [{ ...item, answer: 'E' }] }, 1, 'question')).toBeUndefined()
  })

  it('makes the learning goal primary and bans source-referential questions', () => {
    const prompt = generationSystemPrompt(10, 'question', true)
    expect(prompt).toContain('learning goal is the primary instruction')
    expect(prompt).toContain('exam-relevant')
    expect(prompt).toContain('never say "the source"')
    expect(prompt).toContain('single-best-answer')
  })

  it('settles permanent errors immediately and transient errors on attempt five', () => {
    expect(isTerminalAttempt(new PermanentJobError('invalid'), 1)).toBe(true)
    expect(isTerminalAttempt(new Error('temporary'), 4)).toBe(false)
    expect(isTerminalAttempt(new Error('temporary'), 5)).toBe(true)
  })
})

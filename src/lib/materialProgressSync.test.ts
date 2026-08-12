import { describe, expect, it } from 'vitest'
import { mergeMaterialProgress } from './materialProgressSync'

describe('material progress merge', () => {
  it('unions note reads and keeps answers from the newest side', () => {
    const local = { release: { contentVersion: 'v1', readSectionIds: ['local'], practiceAnswers: { q1: 1 }, practiceSubmitted: false, updatedAt: '2026-08-13T12:00:00Z' } }
    const remote = { release: { contentVersion: 'v1', readSectionIds: ['remote'], practiceAnswers: { q1: 2, q2: 3 }, practiceSubmitted: true, updatedAt: '2026-08-13T11:00:00Z' } }
    expect(mergeMaterialProgress(local, remote).release).toEqual({ contentVersion: 'v1', readSectionIds: ['remote', 'local'], practiceAnswers: { q1: 1, q2: 3 }, practiceSubmitted: true, updatedAt: '2026-08-13T12:00:00Z' })
  })
})

import { describe, expect, it } from 'vitest'
import { matchingMaterialReleaseIds, mergeMaterialProgress, reconcileDirtyMaterialReleaseIds, selectDirtyMaterialProgress } from './materialProgressSync'

describe('material progress merge', () => {
  it('unions note reads and keeps answers from the newest side', () => {
    const local = { release: { contentVersion: 'v1', readSectionIds: ['local'], practiceAnswers: { q1: 1 }, practiceSubmitted: false, updatedAt: '2026-08-13T12:00:00Z' } }
    const remote = { release: { contentVersion: 'v1', readSectionIds: ['remote'], practiceAnswers: { q1: 2, q2: 3 }, practiceSubmitted: true, updatedAt: '2026-08-13T11:00:00Z' } }
    expect(mergeMaterialProgress(local, remote).release).toEqual({ contentVersion: 'v1', readSectionIds: ['local', 'remote'], practiceAnswers: { q1: 1, q2: 3 }, practiceSubmitted: true, updatedAt: '2026-08-13T12:00:00Z' })
  })

  it('canonicalizes key order and resolves equal timestamps independently of merge direction', () => {
    const left = { release: { contentVersion: 'v1', readSectionIds: ['z', 'a'], practiceAnswers: { q2: 1, q1: 2 }, practiceSubmitted: false, updatedAt: '2026-08-13T12:00:00Z' } }
    const right = { release: { contentVersion: 'v1', readSectionIds: ['b', 'a'], practiceAnswers: { q2: 3, q3: 0 }, practiceSubmitted: true, updatedAt: '2026-08-13T12:00:00Z' } }
    expect(mergeMaterialProgress(left, right)).toEqual(mergeMaterialProgress(right, left))
    expect(mergeMaterialProgress(left, right).release).toEqual({ contentVersion: 'v1', readSectionIds: ['a', 'b', 'z'], practiceAnswers: { q1: 2, q2: 3, q3: 0 }, practiceSubmitted: true, updatedAt: '2026-08-13T12:00:00Z' })
  })

  it('uses remote progress when the published content version changed', () => {
    const local = { release: { contentVersion: 'old', readSectionIds: ['stale'], practiceAnswers: { q1: 1 }, practiceSubmitted: true, updatedAt: '2026-08-15T12:00:00Z' } }
    const remote = { release: { contentVersion: 'current', readSectionIds: ['remote'], practiceAnswers: {}, practiceSubmitted: false, updatedAt: '2026-08-14T12:00:00Z' } }
    expect(mergeMaterialProgress(local, remote)).toEqual(remote)
  })

  it('selects only explicitly dirty releases in canonical order', () => {
    const progress = {
      historical: { contentVersion: 'v1', readSectionIds: [], practiceAnswers: {}, practiceSubmitted: false, updatedAt: '2026-08-13T10:00:00Z' },
      dirty: { contentVersion: 'v2', readSectionIds: ['one'], practiceAnswers: {}, practiceSubmitted: false, updatedAt: '2026-08-13T11:00:00Z' },
    }
    expect(selectDirtyMaterialProgress(progress, ['missing', 'dirty', 'dirty'])).toEqual({ dirty: progress.dirty })
  })

  it('reconciles only progress matching the current published release version', () => {
    const local = {
      current: { contentVersion: 'v2', readSectionIds: [], practiceAnswers: {}, practiceSubmitted: false, updatedAt: '2026-08-15T10:00:00.000Z' },
      stale: { contentVersion: 'v1', readSectionIds: [], practiceAnswers: {}, practiceSubmitted: false, updatedAt: '2026-08-15T10:00:00.000Z' },
    }
    expect(matchingMaterialReleaseIds(local, [{ id: 'stale', content_hash: 'v2' }, { id: 'current', content_hash: 'v2' }])).toEqual(['current'])
  })

  it('drops stale dirty releases and retains only compatible current releases', () => {
    expect(reconcileDirtyMaterialReleaseIds(['current-b', 'current-a', 'current-b'])).toEqual(['current-a', 'current-b'])
  })
})

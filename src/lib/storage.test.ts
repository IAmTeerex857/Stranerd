import { describe, expect, it } from 'vitest'
import { parsePersistedState } from './storage'

describe('persistence parsing', () => {
  it('returns safe defaults for corrupt data', () => {
    expect(parsePersistedState('{broken').selectedModelId).toBe('heart')
  })

  it('migrates legacy state without quiz completion data', () => {
    const state = parsePersistedState(JSON.stringify({ selectedModelId: 'heart', completedLessonIds: ['heart-01'] }))
    expect(state.completedLessonIds).toEqual(['heart-01'])
    expect(state.completedQuizIds).toEqual([])
    expect(state.chatByModel).toEqual({})
    expect(state.dissectionActionsByModel).toEqual({})
  })

  it('keeps safe model chat and selection history', () => {
    const state = parsePersistedState(JSON.stringify({
      chatByModel: { heart: [{ id: 'one', role: 'mentor', text: 'Saved', pending: true }, { bad: true }] },
      selectedHotspotIds: { heart: 'left-atrium', bad: 3 },
    }))
    expect(state.chatByModel.heart).toEqual([{ id: 'one', role: 'mentor', text: 'Saved', pending: false }])
    expect(state.selectedHotspotIds).toEqual({ heart: 'left-atrium' })
  })

  it('keeps valid fields and filters malformed collections', () => {
    const state = parsePersistedState(JSON.stringify({ selectedModelId: 'brain', selectedVariantIds: { brain: 'v3', bad: 2 }, completedLessonIds: ['one', 2], completedQuizIds: ['brain-quiz', false], favoriteModelIds: ['brain', 2], bookmarkedHotspotRefs: ['brain:frontal-lobe', null], notes: [{}], settings: { autoRotate: true } }))
    expect(state.selectedModelId).toBe('brain')
    expect(state.completedLessonIds).toEqual(['one'])
    expect(state.completedQuizIds).toEqual(['brain-quiz'])
    expect(state.selectedVariantIds).toEqual({ brain: 'v3' })
    expect(state.favoriteModelIds).toEqual(['brain'])
    expect(state.bookmarkedHotspotRefs).toEqual(['brain:frontal-lobe'])
    expect(state.notes).toEqual([])
    expect(state.settings.autoRotate).toBe(true)
    expect(state.settings.layers).toBe(true)
  })
})

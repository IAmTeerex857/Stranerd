import { describe, expect, it } from 'vitest'
import { anatomyMovementId, createDissectionState, digestiveDissectionQuiz, digestivePancreasSequence, digestiveStructureGroup, dissectionReducer, guidedStepComplete } from './dissection'

describe('dissection state', () => {
  it('composes visibility, transparency, and isolation actions', () => {
    let state = createDissectionState()
    state = dissectionReducer(state, { type: 'hide', ids: ['stomach'] })
    state = dissectionReducer(state, { type: 'toggle-transparent', ids: ['liver'] })
    state = dissectionReducer(state, { type: 'toggle-isolate' })
    expect(state).toMatchObject({ hiddenIds: ['stomach'], transparentIds: ['liver'], offsets: {}, isolate: true })
  })

  it('restores exact snapshots with reset and undo', () => {
    let state = dissectionReducer(createDissectionState(), { type: 'hide', ids: ['stomach', 'liver'] })
    state = dissectionReducer(state, { type: 'reset' })
    expect(state.hiddenIds).toEqual([])
    state = dissectionReducer(state, { type: 'undo' })
    expect(state.hiddenIds).toEqual(['stomach', 'liver'])
  })

  it('keeps hidden structures recoverable', () => {
    let state = dissectionReducer(createDissectionState(), { type: 'hide', ids: ['stomach'] })
    state = dissectionReducer(state, { type: 'show-all' })
    expect(state.hiddenIds).toEqual([])
  })

  it('starts a new mode session without stale undo history', () => {
    let state = dissectionReducer(createDissectionState(), { type: 'hide', ids: ['stomach'] })
    state = dissectionReducer(state, { type: 'clear' })
    expect(state).toEqual(createDissectionState())
  })

  it('records manual movement as one undoable interaction', () => {
    let state = dissectionReducer(createDissectionState(), { type: 'begin-move' })
    state = dissectionReducer(state, { type: 'set-offset', id: 'stomach', offset: [1, 2, 3] })
    expect(state.offsets.stomach).toEqual([1, 2, 3])
    state = dissectionReducer(state, { type: 'undo' })
    expect(state.offsets).toEqual({})
  })

  it('keeps duplicate meshes independently movable under one educational ID', () => {
    const structureId = 'anatomy:skeleton:femur-left'
    const first = anatomyMovementId(structureId, 'mesh-a')
    const second = anatomyMovementId(structureId, 'mesh-b')
    expect(first).not.toBe(second)
    const state = dissectionReducer(createDissectionState(), { type: 'set-offset', id: first, offset: [1, 0, 0] })
    expect(state.offsets[first]).toEqual([1, 0, 0])
    expect(state.offsets[second]).toBeUndefined()
  })

  it('reset clears every independently dragged mesh offset', () => {
    let state = dissectionReducer(createDissectionState(), { type: 'set-offset', id: 'mesh-a', offset: [1, 0, 0] })
    state = dissectionReducer(state, { type: 'set-offset', id: 'mesh-b', offset: [0, 1, 0] })
    state = dissectionReducer(state, { type: 'reset' })
    expect(state.offsets).toEqual({})
    expect(state.isolate).toBe(false)
  })

  it('groups principal digestive structures deterministically', () => {
    expect(digestiveStructureGroup('Gallbladder')).toBe('Hepatobiliary')
    expect(digestiveStructureGroup('Accessory pancreatic duct')).toBe('Pancreas and ducts')
    expect(digestiveStructureGroup('Ascending colon')).toBe('Intestines')
    expect(digestiveStructureGroup('Stomach')).toBe('Upper tract')
  })

  it('completes guided steps only for the required action and stable ID', () => {
    const [hideStomach, isolatePancreas, selectDuodenum] = digestivePancreasSequence.steps
    expect(guidedStepComplete(hideStomach, 'hide', ['anatomy:organs:stomach'])).toBe(true)
    expect(guidedStepComplete(hideStomach, 'select', ['anatomy:organs:stomach'])).toBe(false)
    expect(guidedStepComplete(isolatePancreas, 'isolate', ['anatomy:organs:pancreas'])).toBe(true)
    expect(guidedStepComplete(selectDuodenum, 'select', ['anatomy:organs:duodenum'])).toBe(true)
    expect(digestiveDissectionQuiz.options[digestiveDissectionQuiz.correctIndex]).toBe('Duodenum')
  })
})

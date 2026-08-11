import { describe, expect, it } from 'vitest'
import { realtimeToolOutputEvents, VOICE_EXTENSION_LEAD_MS, voiceRenewalDelay } from './realtime'
import { createLatestValueQueue, createRealtimeFunctionHandler, realtimeFunctionCall, validVoiceContext, voiceActionFromCall, voiceToolsForMode, type VoiceAction } from './voiceActions'

describe('Voice renewal timing', () => {
  it('renews thirty seconds before the paid block ends', () => {
    expect(voiceRenewalDelay(300_000, 0)).toBe(300_000 - VOICE_EXTENSION_LEAD_MS)
  })

  it('renews immediately when already inside the renewal window', () => {
    expect(voiceRenewalDelay(20_000, 0)).toBe(0)
  })
})

describe('Realtime voice tools', () => {
  it('registers only the tools for the active mode', () => {
    expect(voiceToolsForMode('mentor').map((tool) => tool.name)).toEqual(['viewer_camera', 'viewer_settings', 'viewer_selection', 'viewer_variant', 'viewer_layer', 'viewer_dissection'])
    expect(voiceToolsForMode('lab').map((tool) => tool.name)).toContain('viewer_dissection')
    expect(voiceToolsForMode('assessment').map((tool) => tool.name)).toEqual(['assessment_select', 'assessment_navigate', 'assessment_hint', 'assessment_submit'])
    expect(voiceToolsForMode('flashcard').map((tool) => tool.name)).toEqual(['flashcard_side', 'flashcard_navigate', 'flashcard_shuffle', 'flashcard_grade', 'flashcard_hint'])
    expect(voiceToolsForMode('notes')).toEqual([])
  })

  it('parses completed calls from all authoritative GA event shapes', () => {
    const expected = { callId: 'call-1', name: 'flashcard_side', arguments: '{"side":"answer"}' }
    const item = { type: 'function_call', status: 'completed', call_id: 'call-1', name: 'flashcard_side', arguments: '{"side":"answer"}' }
    expect(realtimeFunctionCall({ type: 'response.output_item.done', item })).toEqual(expected)
    expect(realtimeFunctionCall({ type: 'conversation.item.done', item })).toEqual(expected)
    expect(realtimeFunctionCall({ type: 'response.done', response: { status: 'completed', output: [item] } })).toEqual(expected)
  })

  it('ignores argument streams and interrupted, incomplete, or cancelled calls', () => {
    const call = { type: 'function_call', call_id: 'call-1', name: 'flashcard_side', arguments: '{"side":"answer"}' }
    expect(realtimeFunctionCall({ ...call, type: 'response.function_call_arguments.done' })).toBeUndefined()
    for (const status of ['incomplete', 'cancelled', 'interrupted']) {
      expect(realtimeFunctionCall({ type: 'response.output_item.done', item: { ...call, status } })).toBeUndefined()
    }
    expect(realtimeFunctionCall({ type: 'response.done', response: { status: 'cancelled', output: [{ ...call, status: 'completed' }] } })).toBeUndefined()
  })

  it('executes a completed call once when duplicate event shapes arrive', async () => {
    const actions: VoiceAction[] = []
    const outputs: unknown[] = []
    const handler = createRealtimeFunctionHandler(async (action) => { actions.push(action); return { ok: true } }, (callId, result) => outputs.push({ callId, result }))
    const item = { type: 'function_call', status: 'completed', call_id: 'same-call', name: 'assessment_select', arguments: '{"optionIndex":2}' }
    await handler({ ...item, type: 'response.function_call_arguments.done' })
    await handler({ type: 'response.output_item.done', item })
    await handler({ type: 'conversation.item.done', item })
    await handler({ type: 'response.done', response: { status: 'completed', output: [item] } })
    expect(actions).toEqual([{ type: 'assessment.select', optionIndex: 2 }])
    expect(outputs).toHaveLength(1)
  })

  it('returns a failure output when action arguments are invalid', async () => {
    const outputs: unknown[] = []
    const handler = createRealtimeFunctionHandler(() => ({ ok: true }), (callId, result) => outputs.push({ callId, result }))
    await handler({ type: 'response.output_item.done', item: { type: 'function_call', status: 'completed', call_id: 'bad-call', name: 'assessment_submit', arguments: '{"confirmed":false}' } })
    expect(outputs).toEqual([{ callId: 'bad-call', result: { ok: false, error: 'Invalid arguments for voice tool assessment_submit.' } }])
  })

  it('bounds action execution and returns the timeout as tool output', async () => {
    const outputs: unknown[] = []
    const handler = createRealtimeFunctionHandler(() => new Promise(() => undefined), (callId, result) => outputs.push({ callId, result }), 5)
    await handler({ type: 'conversation.item.done', item: { type: 'function_call', status: 'completed', call_id: 'slow-call', name: 'flashcard_shuffle', arguments: '{}' } })
    expect(outputs).toEqual([{ callId: 'slow-call', result: { ok: false, error: 'The voice action timed out.' } }])
  })

  it('creates identified function output and response continuation events', () => {
    let id = 0
    expect(realtimeToolOutputEvents('call-1', { ok: true, message: 'Changed.' }, () => `event-${++id}`)).toEqual([
      { event_id: 'event-1', type: 'conversation.item.create', item: { type: 'function_call_output', call_id: 'call-1', output: '{"ok":true,"message":"Changed."}' } },
      { event_id: 'event-2', type: 'response.create' },
    ])
  })

  it('validates camera and bounded movement actions', () => {
    expect(voiceActionFromCall({ name: 'viewer_camera', arguments: '{"operation":"zoom_in"}' })).toEqual({ type: 'viewer.camera', operation: 'zoom_in' })
    expect(voiceActionFromCall({ name: 'viewer_dissection', arguments: '{"operation":"move","structureIds":["pancreas"],"direction":"out","distance":0.4}' })).toEqual({ type: 'viewer.dissection', operation: 'move', structureIds: ['pancreas'], direction: 'out', distance: 0.4 })
    expect(() => voiceActionFromCall({ name: 'viewer_dissection', arguments: '{"operation":"move","structureIds":["pancreas"],"distance":2}' })).toThrow('Invalid dissection distance.')
  })

  it('requires explicit confirmation for a material flashcard hint', () => {
    expect(voiceActionFromCall({ name: 'flashcard_hint', arguments: '{"confirmed":true}' })).toEqual({ type: 'materialFlashcard.hint', confirmed: true })
    expect(() => voiceActionFromCall({ name: 'flashcard_hint', arguments: '{"confirmed":false}' })).toThrow('Invalid arguments')
  })

  it('rejects answer keys from assessment voice context', () => {
    const context = { screen: 'assessment', model: { id: 'heart', name: 'Heart', variantId: 'adult', variants: [{ id: 'adult', label: 'Adult' }], system: 'cardiovascular', facts: [] }, selectedStructure: null, recentActions: [], assessment: { questionId: 'q1', index: 0, count: 1, question: 'Q', options: ['A', 'B'], selectedIndex: null, submitted: false } }
    expect(validVoiceContext('assessment', context)).toBe(true)
    expect(validVoiceContext('assessment', { ...context, assessment: { ...context.assessment, correctIndex: 1 } })).toBe(false)
    expect(validVoiceContext('assessment', { ...context, assessment: { ...context.assessment, answerKey: 'B' } })).toBe(false)
    expect(validVoiceContext('assessment', { ...context, solution: 'B' })).toBe(false)
    expect(validVoiceContext('flashcard', { screen: 'assessment' })).toBe(false)
  })

  it('requires the mode-specific application state', () => {
    const common = { model: { id: 'heart', name: 'Heart', variantId: 'adult', variants: [], system: 'cardiovascular', facts: [] }, selectedStructure: null, recentActions: [] }
    const viewer = { settings: { autoRotate: false, wireframe: false, layers: true, isolate: false, labels: true }, layers: [], state: { dissectMode: true, structures: [], visibleLayerIds: [], hiddenStructureIds: [], fadedStructureIds: [], isolated: false } }
    expect(validVoiceContext('mentor', { screen: 'mentor', ...common })).toBe(false)
    expect(validVoiceContext('lab', { screen: 'lab', ...common, viewer, lab: { stepIndex: null } })).toBe(true)
    expect(validVoiceContext('flashcard', { screen: 'flashcard', ...common, flashcard: { deckId: 'd1', cardId: 'c1', index: 0, count: 1, side: 'question', graded: false, question: { heading: 'Q', body: 'Body' } } })).toBe(true)
    expect(validVoiceContext('flashcard', { screen: 'flashcard', ...common, flashcard: { deckId: 'materials:r1', cardId: 'c1', index: 0, count: 1, side: 'question', graded: false, question: { heading: 'Q', body: 'Body' }, hint: 'Recall the relevant relationship.' } })).toBe(true)
    expect(validVoiceContext('flashcard', { screen: 'flashcard', ...common, flashcard: { deckId: 'materials:r1', cardId: 'c1', index: 0, count: 1, side: 'question', graded: false, question: { heading: 'Q', body: 'Body' }, answer: { heading: 'A', body: 'Leaked' } } })).toBe(false)
    expect(validVoiceContext('flashcard', { screen: 'flashcard', ...common, flashcard: { deckId: 'd1' } })).toBe(false)
  })

  it('accepts bounded read-only note context and no extra fields', () => {
    const note = { subject: 'Anatomy', subjectSlug: 'anatomy', releaseId: 'r1', sectionId: 's1', section: 'Thorax', pageStart: 2, pageEnd: 3, selectedText: 'Heart' }
    expect(validVoiceContext('notes', { screen: 'notes', note })).toBe(true)
    expect(validVoiceContext('notes', { screen: 'notes', note: { ...note, answerKey: 'A' } })).toBe(false)
    expect(validVoiceContext('notes', { screen: 'notes', note: { ...note, selectedText: 'x'.repeat(2_001) } })).toBe(false)
  })

  it('queues only the latest context until transport opens', () => {
    let open = false
    const sent: string[] = []
    const queue = createLatestValueQueue(() => open, (value: string) => sent.push(value))
    queue.push('old')
    queue.push('latest')
    expect(sent).toEqual([])
    open = true
    queue.flush()
    queue.push('live')
    expect(sent).toEqual(['latest', 'live'])
  })
})

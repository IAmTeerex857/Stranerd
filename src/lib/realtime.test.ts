import { describe, expect, it } from 'vitest'
import { confirmVoiceExtension, realtimeToolOutputEvents, VOICE_EXTENSION_LEAD_MS, voiceRenewalDelay } from './realtime'
import { createLatestValueQueue, createRealtimeFunctionHandler, realtimeFunctionCall, sanitizeVoiceContext, validVoiceContext, voiceActionFromCall, voiceToolsForMode, type VoiceAction } from './voiceActions'

describe('Voice renewal timing', () => {
  it('renews thirty seconds before the paid block ends', () => {
    expect(voiceRenewalDelay(300_000, 0)).toBe(300_000 - VOICE_EXTENSION_LEAD_MS)
  })

  it('renews immediately when already inside the renewal window', () => {
    expect(voiceRenewalDelay(20_000, 0)).toBe(0)
  })

  it('extends only after visible confirmation succeeds', async () => {
    expect(await confirmVoiceExtension(() => false)).toBe(false)
    expect(await confirmVoiceExtension(() => true)).toBe(true)
  })
})

describe('Realtime voice tools', () => {
  it('registers the same universal safe tools for every mode', () => {
    const names = voiceToolsForMode('mentor').map((tool) => tool.name)
    expect(names).toContain('navigation_open')
    expect(names).toContain('viewer_dissection')
    expect(names).toContain('assessment_corrections')
    expect(names).toContain('assessment_review')
    expect(names).toContain('flashcard_hint')
    expect(names).toContain('library_open_set')
    expect(voiceToolsForMode('notes').map((tool) => tool.name)).toEqual(names)
  })

  it('exposes one targeted isolation path and high-level dissection operations', () => {
    const tools = voiceToolsForMode('mentor')
    const settings = tools.find((tool) => tool.name === 'viewer_settings')!
    const dissection = tools.find((tool) => tool.name === 'viewer_dissection')!
    const settingsProperties = (settings.parameters.properties as Record<string, unknown>)
    const operation = ((dissection.parameters.properties as Record<string, { enum?: string[] }>).operation)
    expect(settingsProperties).not.toHaveProperty('isolate')
    expect(operation.enum).toEqual(expect.arrayContaining(['isolate', 'separate', 'restore']))
    expect(dissection.description).toContain('at least 2 named structures')
    expect(dissection.description).toContain('restore the complete model')
    expect(() => voiceActionFromCall({ name: 'viewer_settings', arguments: '{"isolate":true}' })).toThrow('Invalid viewer settings.')
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

  it('serializes distinct calls arriving in separate provider events', async () => {
    let releaseFirst!: () => void
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })
    let active = 0
    let maxActive = 0
    const actions: VoiceAction[] = []
    const outputs: string[] = []
    const handler = createRealtimeFunctionHandler(async (action) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      actions.push(action)
      if (actions.length === 1) await firstGate
      active -= 1
      return { ok: true }
    }, (callId) => outputs.push(callId))
    const event = (callId: string, optionIndex: number) => ({ type: 'conversation.item.done', item: { type: 'function_call', status: 'completed', call_id: callId, name: 'assessment_select', arguments: JSON.stringify({ optionIndex }) } })
    const first = handler(event('first', 1))
    const second = handler(event('second', 2))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(actions).toEqual([{ type: 'assessment.select', optionIndex: 1 }])
    releaseFirst()
    await Promise.all([first, second])
    expect(actions).toEqual([{ type: 'assessment.select', optionIndex: 1 }, { type: 'assessment.select', optionIndex: 2 }])
    expect(outputs).toEqual(['first', 'second'])
    expect(maxActive).toBe(1)
  })

  it('completes one continuation after every call in a provider batch', async () => {
    const outputs: string[] = []
    let continuations = 0
    const handler = createRealtimeFunctionHandler(() => ({ ok: true }), (callId) => outputs.push(callId), 10_000, () => { continuations += 1 })
    const call = (callId: string, side: 'question' | 'answer') => ({ type: 'function_call', status: 'completed', call_id: callId, name: 'flashcard_side', arguments: JSON.stringify({ side }) })
    await handler({ type: 'response.done', response: { status: 'completed', output: [call('first', 'answer'), call('second', 'question')] } })
    expect(outputs).toEqual(['first', 'second'])
    expect(continuations).toBe(1)
  })

  it('creates identified function output and response continuation events', () => {
    let id = 0
    expect(realtimeToolOutputEvents('call-1', { ok: true, message: 'Changed.' }, () => `event-${++id}`)).toEqual([
      { event_id: 'event-1', type: 'conversation.item.create', item: { type: 'function_call_output', call_id: 'call-1', output: '{"ok":true,"message":"Changed."}' } },
      { event_id: 'event-2', type: 'response.create' },
    ])
  })

  it('drops oversized tool context while preserving the successful result', () => {
    const event = realtimeToolOutputEvents('call-large', { ok: true, message: 'Changed.', context: { text: 'x'.repeat(13_000) } })[0] as { item: { output: string } }
    expect(JSON.parse(event.item.output)).toEqual({ ok: true, message: 'Changed.' })
    expect(event.item.output.length).toBeLessThan(12_000)
  })

  it('validates camera and bounded movement actions', () => {
    expect(voiceActionFromCall({ name: 'viewer_camera', arguments: '{"operation":"zoom_in"}' })).toEqual({ type: 'viewer.camera', operation: 'zoom_in' })
    expect(voiceActionFromCall({ name: 'viewer_dissection', arguments: '{"operation":"move","structureIds":["pancreas"],"direction":"out","distance":0.4}' })).toEqual({ type: 'viewer.dissection', operation: 'move', structureIds: ['pancreas'], direction: 'out', distance: 0.4 })
    expect(() => voiceActionFromCall({ name: 'viewer_dissection', arguments: '{"operation":"move","structureIds":["pancreas"],"distance":2}' })).toThrow('Invalid dissection distance.')
    expect(voiceActionFromCall({ name: 'viewer_dissection', arguments: '{"operation":"separate","structureIds":["liver","pancreas"]}' })).toEqual({ type: 'viewer.dissection', operation: 'separate', structureIds: ['liver', 'pancreas'], direction: undefined, distance: undefined })
    expect(voiceActionFromCall({ name: 'viewer_dissection', arguments: '{"operation":"restore","structureIds":[]}' })).toEqual({ type: 'viewer.dissection', operation: 'restore', structureIds: [], direction: undefined, distance: undefined })
    expect(() => voiceActionFromCall({ name: 'viewer_dissection', arguments: '{"operation":"separate","structureIds":["liver"]}' })).toThrow('Separate requires at least two structures.')
    expect(() => voiceActionFromCall({ name: 'viewer_dissection', arguments: '{"operation":"restore","structureIds":["liver"]}' })).toThrow('Restore applies to the complete model')
  })

  it('does not accept model-supplied payment confirmation', () => {
    expect(voiceActionFromCall({ name: 'flashcard_hint', arguments: '{}' })).toEqual({ type: 'materialFlashcard.hint' })
    expect(() => voiceActionFromCall({ name: 'flashcard_hint', arguments: '{"confirmed":true}' })).toThrow('Invalid arguments')
    expect(voiceActionFromCall({ name: 'assessment_corrections', arguments: '{}' })).toEqual({ type: 'assessment.corrections' })
  })

  it('parses bounded global navigation actions', () => {
    expect(voiceActionFromCall({ name: 'navigation_open', arguments: '{"destination":"explore","modelId":"heart","expectedRevision":4}' })).toEqual({ type: 'navigation.open', destination: 'explore', modelId: 'heart', expectedRevision: 4 })
    expect(voiceActionFromCall({ name: 'navigation_back', arguments: '{}' })).toEqual({ type: 'navigation.back', expectedRevision: undefined })
    expect(() => voiceActionFromCall({ name: 'navigation_open', arguments: '{"destination":"billing"}' })).toThrow('Invalid arguments')
  })

  it('parses only bounded Studio set opening actions', () => {
    expect(voiceActionFromCall({ name: 'library_open_set', arguments: '{"setId":"20000000-0000-4000-8000-000000000002","expectedRevision":3}' })).toEqual({ type: 'library.openSet', setId: '20000000-0000-4000-8000-000000000002', expectedRevision: 3 })
    expect(() => voiceActionFromCall({ name: 'library_open_set', arguments: '{"setId":"x","title":"Injected"}' })).toThrow('Invalid arguments')
  })

  it('parses only bounded Learn deck opening actions', () => {
    expect(voiceActionFromCall({ name: 'library_open_deck', arguments: '{"deckId":"materials:release-heart","expectedRevision":3}' })).toEqual({ type: 'library.openDeck', deckId: 'materials:release-heart', expectedRevision: 3 })
    expect(() => voiceActionFromCall({ name: 'library_open_deck', arguments: `{"deckId":"${'x'.repeat(201)}"}` })).toThrow('Invalid arguments')
    const context = { screen: 'app', workspace: { view: 'library', section: 'flashcards', revision: 3, canGoBack: false, decks: [{ id: 'materials:release-heart', title: 'Heart' }, { id: 'materials:release-endocrine', title: 'Endocrine System' }] } }
    expect(validVoiceContext('app', context)).toBe(true)
    expect(validVoiceContext('app', { ...context, workspace: { ...context.workspace, section: 'notes' } })).toBe(false)
    expect(validVoiceContext('app', { ...context, workspace: { ...context.workspace, decks: [{ id: 'heart-core', title: 'Legacy heart deck' }] } })).toBe(false)
    expect(validVoiceContext('app', { ...context, workspace: { ...context.workspace, decks: [{ id: 'generated-deck', title: 'Generated deck' }] } })).toBe(false)
  })

  it('parses answer review without accepting model-supplied authorization', () => {
    expect(voiceActionFromCall({ name: 'assessment_review', arguments: '{}' })).toEqual({ type: 'assessment.review' })
    expect(() => voiceActionFromCall({ name: 'assessment_review', arguments: '{"generate":true}' })).toThrow('Invalid arguments')
  })

  it('rejects answer keys from assessment voice context', () => {
    const context = { screen: 'assessment', model: { id: 'heart', name: 'Heart', variantId: 'adult', variants: [{ id: 'adult', label: 'Adult' }], system: 'cardiovascular', facts: [] }, selectedStructure: null, recentActions: [], assessment: { questionId: 'q1', index: 0, count: 1, question: 'Q', options: ['A', 'B'], selectedIndex: null, submitted: false } }
    expect(validVoiceContext('assessment', context)).toBe(true)
    expect(validVoiceContext('assessment', { ...context, assessment: { ...context.assessment, correctIndex: 1 } })).toBe(false)
    expect(validVoiceContext('assessment', { ...context, assessment: { ...context.assessment, answerKey: 'B' } })).toBe(false)
    expect(validVoiceContext('assessment', { ...context, solution: 'B' })).toBe(false)
    expect(validVoiceContext('flashcard', { screen: 'assessment' })).toBe(false)
    expect(validVoiceContext('assessment', { ...context, assessment: { ...context.assessment, submitted: true, phase: 'review', correctAnswer: 'B', explanation: 'Because.' } })).toBe(true)
    expect(validVoiceContext('assessment', { ...context, assessment: { ...context.assessment, submitted: true, phase: 'result', correctAnswer: 'B' } })).toBe(false)
  })

  it('allows a bounded Studio catalog without accepting hidden set data', () => {
    const context = { screen: 'app', workspace: { view: 'studio', section: 'studio', revision: 2, canGoBack: false, librarySets: [{ id: '20000000-0000-4000-8000-000000000002', title: 'Cardiology', type: 'practice' }] } }
    expect(validVoiceContext('app', context)).toBe(true)
    expect(validVoiceContext('app', { ...context, workspace: { ...context.workspace, librarySets: [{ ...context.workspace.librarySets[0], items: [{ correctIndex: 1 }] }] } })).toBe(false)
  })

  it('does not leak Studio practice corrections before review', () => {
    const common = { screen: 'assessment', model: { id: 'heart', name: 'Heart', variantId: 'adult', variants: [], system: 'cardiovascular', facts: [] }, selectedStructure: null, recentActions: [] }
    const assessment = { questionId: 'studio-q1', index: 0, count: 2, question: 'Question', options: ['A', 'B', 'C', 'D'], selectedIndex: 1, submitted: false, phase: 'taking' }
    expect(validVoiceContext('assessment', { ...common, assessment })).toBe(true)
    expect(validVoiceContext('assessment', { ...common, assessment: { ...assessment, correctAnswer: 'C', explanation: 'Hidden.' } })).toBe(false)
    expect(validVoiceContext('assessment', { ...common, assessment: { ...assessment, submitted: true, phase: 'review', score: 1, correctAnswer: 'C', explanation: 'Existing generated correction.' } })).toBe(true)
  })

  it('requires the mode-specific application state', () => {
    const common = { model: { id: 'heart', name: 'Heart', variantId: 'adult', variants: [], system: 'cardiovascular', facts: [] }, selectedStructure: null, recentActions: [] }
    const viewer = { settings: { autoRotate: false, wireframe: false, layers: true, isolate: false, labels: true }, layers: [], state: { dissectMode: true, variantId: 'adult', structures: [], visibleLayerIds: [], hiddenStructureIds: [], fadedStructureIds: [], isolated: false, isolationSource: 'none', movedStructureIds: [], camera: { position: [0, 0, 4], target: [0, 0, 0], zoom: 4 }, loading: false, selectedStructureIds: [] } }
    expect(validVoiceContext('mentor', { screen: 'mentor', ...common })).toBe(false)
    expect(validVoiceContext('lab', { screen: 'lab', ...common, viewer, lab: { stepIndex: null } })).toBe(true)
    expect(validVoiceContext('lab', { screen: 'lab', ...common, viewer: { ...viewer, state: { ...viewer.state, isolationSource: 'legacy' } }, lab: { stepIndex: null } })).toBe(false)
    expect(validVoiceContext('lab', { screen: 'lab', ...common, viewer: { ...viewer, state: { ...viewer.state, movedStructureIds: Array(51).fill('x') } }, lab: { stepIndex: null } })).toBe(false)
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

  it('canonicalizes validated context for stable deduplication', () => {
    const first = sanitizeVoiceContext('app', { screen: 'app', workspace: { view: 'studio', revision: 2, canGoBack: false, section: 'studio' } })
    const second = sanitizeVoiceContext('app', { workspace: { section: 'studio', canGoBack: false, revision: 2, view: 'studio' }, screen: 'app' })
    expect(first?.fingerprint).toBe(second?.fingerprint)
    expect(sanitizeVoiceContext('app', { screen: 'app', workspace: { view: 'billing', revision: 2, canGoBack: false } })).toBeUndefined()
  })
})

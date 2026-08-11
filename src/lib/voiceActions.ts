export const VOICE_MODES = ['mentor', 'lab', 'assessment', 'flashcard', 'notes'] as const
export type VoiceMode = typeof VOICE_MODES[number]

export type VoiceAction =
  | { type: 'viewer.camera'; operation: 'reset' | 'zoom_in' | 'zoom_out' | 'rotate_left' | 'rotate_right' | 'rotate_up' | 'rotate_down' }
  | { type: 'viewer.settings'; settings: Partial<{ autoRotate: boolean; wireframe: boolean; layers: boolean; isolate: boolean; labels: boolean }> }
  | { type: 'viewer.selection'; structureIds: string[] }
  | { type: 'viewer.variant'; variantId: string }
  | { type: 'viewer.layer'; layerId: string; visible: boolean }
  | { type: 'viewer.dissection'; operation: 'hide' | 'show' | 'isolate' | 'transparent' | 'move' | 'show_all' | 'undo' | 'reset'; structureIds: string[]; direction?: 'left' | 'right' | 'up' | 'down' | 'out'; distance?: number }
  | { type: 'assessment.select'; optionIndex: number }
  | { type: 'assessment.navigate'; direction: 'previous' | 'next' }
  | { type: 'assessment.hint'; confirmed: true }
  | { type: 'assessment.submit'; confirmed: true }
  | { type: 'flashcard.side'; side: 'question' | 'answer' }
  | { type: 'flashcard.navigate'; direction: 'previous' | 'next' }
  | { type: 'flashcard.shuffle' }
  | { type: 'flashcard.grade'; grade: 'again' | 'hard' | 'good' | 'easy' }
  | { type: 'materialFlashcard.hint'; confirmed: true }

export type VoiceActionResult =
  | { ok: true; message?: string; context?: unknown }
  | { ok: false; error: string }

export type RealtimeFunctionTool = {
  type: 'function'
  name: string
  description: string
  parameters: Record<string, unknown>
}

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
})

const viewerTools: RealtimeFunctionTool[] = [
  {
    type: 'function',
    name: 'viewer_camera',
    description: 'Reset, zoom, or rotate the anatomy camera.',
    parameters: objectSchema({ operation: { type: 'string', enum: ['reset', 'zoom_in', 'zoom_out', 'rotate_left', 'rotate_right', 'rotate_up', 'rotate_down'] } }, ['operation']),
  },
  {
    type: 'function',
    name: 'viewer_settings',
    description: 'Change one or more visible anatomy canvas settings.',
    parameters: { ...objectSchema({
      autoRotate: { type: 'boolean' },
      wireframe: { type: 'boolean' },
      layers: { type: 'boolean' },
      isolate: { type: 'boolean' },
      labels: { type: 'boolean' },
    }), minProperties: 1 },
  },
  {
    type: 'function',
    name: 'viewer_selection',
    description: 'Replace the current canvas selection using structure IDs or exact anatomy names. Use an empty array to clear it.',
    parameters: objectSchema({ structureIds: { type: 'array', items: { type: 'string' }, maxItems: 20 } }, ['structureIds']),
  },
  {
    type: 'function',
    name: 'viewer_variant',
    description: 'Change to a specimen variant ID listed in the current context.',
    parameters: objectSchema({ variantId: { type: 'string' } }, ['variantId']),
  },
  {
    type: 'function',
    name: 'viewer_layer',
    description: 'Show or hide an anatomy system layer ID listed in the current context.',
    parameters: objectSchema({ layerId: { type: 'string' }, visible: { type: 'boolean' } }, ['layerId', 'visible']),
  },
]

const dissectionTool: RealtimeFunctionTool = {
  type: 'function',
  name: 'viewer_dissection',
  description: 'Perform a reversible dissection operation using structure IDs or exact anatomy names. Whole-view actions use an empty structure array.',
  parameters: objectSchema({
    operation: { type: 'string', enum: ['hide', 'show', 'isolate', 'transparent', 'move', 'show_all', 'undo', 'reset'] },
    structureIds: { type: 'array', items: { type: 'string' }, maxItems: 20 },
    direction: { type: 'string', enum: ['left', 'right', 'up', 'down', 'out'] },
    distance: { type: 'number', minimum: 0.1, maximum: 1 },
  }, ['operation', 'structureIds']),
}

const assessmentTools: RealtimeFunctionTool[] = [
  { type: 'function', name: 'assessment_select', description: 'Select a zero-based option for the current assessment question.', parameters: objectSchema({ optionIndex: { type: 'integer', minimum: 0, maximum: 9 } }, ['optionIndex']) },
  { type: 'function', name: 'assessment_navigate', description: 'Move to the previous or next assessment question.', parameters: objectSchema({ direction: { type: 'string', enum: ['previous', 'next'] } }, ['direction']) },
  { type: 'function', name: 'assessment_hint', description: 'Request the paid hint only after the learner explicitly confirms the charge.', parameters: objectSchema({ confirmed: { type: 'boolean', enum: [true] } }, ['confirmed']) },
  { type: 'function', name: 'assessment_submit', description: 'Submit the complete assessment only after the learner explicitly confirms submission.', parameters: objectSchema({ confirmed: { type: 'boolean', enum: [true] } }, ['confirmed']) },
]

const flashcardTools: RealtimeFunctionTool[] = [
  { type: 'function', name: 'flashcard_side', description: 'Show either the question or answer side of the current flashcard.', parameters: objectSchema({ side: { type: 'string', enum: ['question', 'answer'] } }, ['side']) },
  { type: 'function', name: 'flashcard_navigate', description: 'Move to the previous or next flashcard.', parameters: objectSchema({ direction: { type: 'string', enum: ['previous', 'next'] } }, ['direction']) },
  { type: 'function', name: 'flashcard_shuffle', description: 'Shuffle the current flashcard deck.', parameters: objectSchema({}) },
  { type: 'function', name: 'flashcard_grade', description: 'Grade the revealed flashcard response.', parameters: objectSchema({ grade: { type: 'string', enum: ['again', 'hard', 'good', 'easy'] } }, ['grade']) },
  { type: 'function', name: 'flashcard_hint', description: 'Request a paid material flashcard hint only after the learner explicitly confirms the charge.', parameters: objectSchema({ confirmed: { type: 'boolean', enum: [true] } }, ['confirmed']) },
]

export function voiceToolsForMode(mode: VoiceMode): RealtimeFunctionTool[] {
  if (mode === 'notes') return []
  if (mode === 'assessment') return assessmentTools
  if (mode === 'flashcard') return flashcardTools
  return [...viewerTools, dissectionTool]
}

const forbiddenAssessmentKeys = new Set(['answer', 'answerkey', 'correctanswer', 'correctindex', 'explanation'])

function containsForbiddenAssessmentData(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenAssessmentData)
  const valueRecord = record(value)
  if (!valueRecord) return false
  return Object.entries(valueRecord).some(([key, entry]) => forbiddenAssessmentKeys.has(key.toLowerCase().replace(/[^a-z]/g, '')) || containsForbiddenAssessmentData(entry))
}

export function validVoiceContext(mode: VoiceMode, context: unknown) {
  const contextRecord = record(context)
  if (!contextRecord || contextRecord.screen !== mode) return false
  if (mode === 'notes') {
    const note = record(contextRecord.note)
    const noteKeys = ['subject', 'subjectSlug', 'releaseId', 'sectionId', 'section', 'pageStart', 'pageEnd', 'selectedText']
    return Boolean(note)
      && onlyKeys(contextRecord, ['screen', 'note'])
      && onlyKeys(note!, noteKeys)
      && ['subject', 'subjectSlug', 'releaseId', 'sectionId', 'section', 'selectedText'].every((key) => typeof note![key] === 'string')
      && (note!.selectedText as string).length <= 2_000
      && Number.isInteger(note!.pageStart)
      && Number.isInteger(note!.pageEnd)
  }
  const topLevelKeys = ['screen', 'model', 'selectedStructure', 'recentActions', ...(mode === 'mentor' ? ['viewer'] : mode === 'lab' ? ['viewer', 'lab'] : [mode])]
  if (!onlyKeys(contextRecord, topLevelKeys) || !validCommonContext(contextRecord)) return false
  if (mode === 'mentor') return validViewerContext(contextRecord.viewer)
  if (mode === 'lab') return validViewerContext(contextRecord.viewer) && validLabContext(contextRecord.lab)
  if (mode === 'flashcard') return validFlashcardContext(contextRecord.flashcard)
  const assessment = record(contextRecord.assessment)
  const assessmentKeys = ['questionId', 'index', 'count', 'question', 'options', 'selectedIndex', 'submitted', 'hint']
  if (!assessment || !onlyKeys(assessment, assessmentKeys) || containsForbiddenAssessmentData(context)) return false
  return typeof assessment.questionId === 'string'
    && Number.isInteger(assessment.index)
    && Number.isInteger(assessment.count)
    && typeof assessment.question === 'string'
    && Array.isArray(assessment.options)
    && assessment.options.length >= 2
    && assessment.options.every((option) => typeof option === 'string')
    && (assessment.selectedIndex === null || Number.isInteger(assessment.selectedIndex))
    && typeof assessment.submitted === 'boolean'
    && (assessment.hint === undefined || typeof assessment.hint === 'string')
}

function validCommonContext(context: Record<string, unknown>) {
  const model = record(context.model)
  const selected = context.selectedStructure === null ? null : record(context.selectedStructure)
  return Boolean(model)
    && onlyKeys(model!, ['id', 'name', 'variantId', 'variants', 'system', 'facts'])
    && ['id', 'name', 'variantId', 'system'].every((key) => typeof model![key] === 'string')
    && validObjectArray(model!.variants, ['id', 'label'], (entry) => typeof entry.id === 'string' && typeof entry.label === 'string', 50)
    && stringArray(model!.facts)
    && (selected === null || (onlyKeys(selected!, ['id', 'label', 'detail']) && ['id', 'label', 'detail'].every((key) => typeof selected![key] === 'string')))
    && validObjectArray(context.recentActions, ['action', 'structureIds', 'structures'], (entry) => typeof entry.action === 'string' && stringArray(entry.structureIds) && stringArray(entry.structures), 10)
}

function validViewerContext(value: unknown) {
  const viewer = record(value)
  const settings = record(viewer?.settings)
  const state = record(viewer?.state)
  return Boolean(viewer && settings && state)
    && onlyKeys(viewer!, ['settings', 'layers', 'state'])
    && onlyKeys(settings!, ['autoRotate', 'wireframe', 'layers', 'isolate', 'labels'])
    && Object.values(settings!).every((entry) => typeof entry === 'boolean')
    && validObjectArray(viewer!.layers, ['id', 'label', 'visible'], (entry) => typeof entry.id === 'string' && typeof entry.label === 'string' && typeof entry.visible === 'boolean', 50)
    && onlyKeys(state!, ['dissectMode', 'structures', 'visibleLayerIds', 'hiddenStructureIds', 'fadedStructureIds', 'isolated'])
    && typeof state!.dissectMode === 'boolean'
    && validObjectArray(state!.structures, ['id', 'label'], (entry) => typeof entry.id === 'string' && typeof entry.label === 'string', 50)
    && boundedStringArray(state!.visibleLayerIds, 50)
    && boundedStringArray(state!.hiddenStructureIds, 50)
    && boundedStringArray(state!.fadedStructureIds, 50)
    && typeof state!.isolated === 'boolean'
}

function validLabContext(value: unknown) {
  const lab = record(value)
  return Boolean(lab)
    && onlyKeys(lab!, ['activityId', 'stepIndex', 'prompt', 'validated'])
    && (lab!.activityId === undefined || typeof lab!.activityId === 'string')
    && (lab!.stepIndex === null || Number.isInteger(lab!.stepIndex))
    && (lab!.prompt === undefined || typeof lab!.prompt === 'string')
    && (lab!.validated === undefined || typeof lab!.validated === 'boolean')
}

function validFlashcardContext(value: unknown) {
  const flashcard = record(value)
  const question = record(flashcard?.question)
  const answer = flashcard?.answer === undefined ? undefined : record(flashcard.answer)
  const validSide = (side: Record<string, unknown> | undefined) => Boolean(side) && onlyKeys(side!, ['heading', 'body']) && typeof side!.heading === 'string' && typeof side!.body === 'string'
  return Boolean(flashcard)
    && onlyKeys(flashcard!, ['deckId', 'cardId', 'index', 'count', 'side', 'graded', 'question', 'answer', 'hint'])
    && typeof flashcard!.deckId === 'string'
    && typeof flashcard!.cardId === 'string'
    && Number.isInteger(flashcard!.index)
    && Number.isInteger(flashcard!.count)
    && (flashcard!.side === 'question' || flashcard!.side === 'answer')
    && typeof flashcard!.graded === 'boolean'
    && validSide(question)
    && (answer === undefined || validSide(answer))
    && (flashcard!.side === 'answer' || answer === undefined)
    && (flashcard!.hint === undefined || typeof flashcard!.hint === 'string')
}

type FunctionCall = { callId: string; name: string; arguments: string }

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

export function realtimeFunctionCalls(event: unknown): FunctionCall[] {
  const message = record(event)
  if (!message) return []
  let sources: Record<string, unknown>[] = []
  if ((message.type === 'response.output_item.done' || message.type === 'conversation.item.done') && record(message.item)) sources = [record(message.item)!]
  if (message.type === 'response.done') {
    const response = record(message.response)
    if (response?.status !== 'completed' || !Array.isArray(response.output)) return []
    sources = response.output.flatMap((item) => record(item) ? [record(item)!] : [])
  }
  return sources.flatMap((source) => {
    if (source.type !== 'function_call' || (source.status !== undefined && source.status !== 'completed')) return []
    const call = functionCall(source)
    return call ? [call] : []
  })
}

function functionCall(source: Record<string, unknown>): FunctionCall | undefined {
  const callId = source.call_id
  const name = source.name
  const args = source.arguments
  return typeof callId === 'string' && typeof name === 'string' && typeof args === 'string' ? { callId, name, arguments: args } : undefined
}

export function realtimeFunctionCall(event: unknown): FunctionCall | undefined {
  return realtimeFunctionCalls(event)[0]
}

function stringArray(value: unknown): value is string[] {
  return boundedStringArray(value, 20)
}

function boundedStringArray(value: unknown, maxItems: number): value is string[] {
  return Array.isArray(value) && value.length <= maxItems && value.every((entry) => typeof entry === 'string')
}

function validObjectArray(value: unknown, keys: readonly string[], validate: (entry: Record<string, unknown>) => boolean, maxItems: number) {
  return Array.isArray(value) && value.length <= maxItems && value.every((item) => {
    const entry = record(item)
    return Boolean(entry) && onlyKeys(entry!, keys) && validate(entry!)
  })
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key))
}

export function voiceActionFromCall(call: Pick<FunctionCall, 'name' | 'arguments'>): VoiceAction {
  const args = record(JSON.parse(call.arguments))
  if (!args) throw new Error('Tool arguments must be an object.')
  if (call.name === 'viewer_camera' && onlyKeys(args, ['operation']) && ['reset', 'zoom_in', 'zoom_out', 'rotate_left', 'rotate_right', 'rotate_up', 'rotate_down'].includes(String(args.operation))) return { type: 'viewer.camera', operation: args.operation as Extract<VoiceAction, { type: 'viewer.camera' }>['operation'] }
  if (call.name === 'viewer_settings') {
    const keys = ['autoRotate', 'wireframe', 'layers', 'isolate', 'labels'] as const
    if (!keys.some((key) => typeof args[key] === 'boolean') || Object.keys(args).some((key) => !keys.includes(key as typeof keys[number]) || typeof args[key] !== 'boolean')) throw new Error('Invalid viewer settings.')
    return { type: 'viewer.settings', settings: args as Extract<VoiceAction, { type: 'viewer.settings' }>['settings'] }
  }
  if (call.name === 'viewer_selection' && onlyKeys(args, ['structureIds']) && stringArray(args.structureIds)) return { type: 'viewer.selection', structureIds: args.structureIds }
  if (call.name === 'viewer_variant' && typeof args.variantId === 'string' && Object.keys(args).length === 1) return { type: 'viewer.variant', variantId: args.variantId }
  if (call.name === 'viewer_layer' && typeof args.layerId === 'string' && typeof args.visible === 'boolean' && Object.keys(args).length === 2) return { type: 'viewer.layer', layerId: args.layerId, visible: args.visible }
  if (call.name === 'viewer_dissection' && onlyKeys(args, ['operation', 'structureIds', 'direction', 'distance']) && ['hide', 'show', 'isolate', 'transparent', 'move', 'show_all', 'undo', 'reset'].includes(String(args.operation)) && stringArray(args.structureIds)) {
    if (args.direction !== undefined && !['left', 'right', 'up', 'down', 'out'].includes(String(args.direction))) throw new Error('Invalid dissection direction.')
    if (args.distance !== undefined && (typeof args.distance !== 'number' || args.distance < 0.1 || args.distance > 1)) throw new Error('Invalid dissection distance.')
    return { type: 'viewer.dissection', operation: args.operation as Extract<VoiceAction, { type: 'viewer.dissection' }>['operation'], structureIds: args.structureIds, direction: args.direction as Extract<VoiceAction, { type: 'viewer.dissection' }>['direction'], distance: args.distance as number | undefined }
  }
  if (call.name === 'assessment_select' && onlyKeys(args, ['optionIndex']) && Number.isInteger(args.optionIndex) && (args.optionIndex as number) >= 0 && (args.optionIndex as number) <= 9) return { type: 'assessment.select', optionIndex: args.optionIndex as number }
  if (call.name === 'assessment_navigate' && onlyKeys(args, ['direction']) && (args.direction === 'previous' || args.direction === 'next')) return { type: 'assessment.navigate', direction: args.direction }
  if (call.name === 'assessment_hint' && onlyKeys(args, ['confirmed']) && args.confirmed === true) return { type: 'assessment.hint', confirmed: true }
  if (call.name === 'assessment_submit' && onlyKeys(args, ['confirmed']) && args.confirmed === true) return { type: 'assessment.submit', confirmed: true }
  if (call.name === 'flashcard_side' && (args.side === 'question' || args.side === 'answer') && Object.keys(args).length === 1) return { type: 'flashcard.side', side: args.side }
  if (call.name === 'flashcard_navigate' && onlyKeys(args, ['direction']) && (args.direction === 'previous' || args.direction === 'next')) return { type: 'flashcard.navigate', direction: args.direction }
  if (call.name === 'flashcard_shuffle' && Object.keys(args).length === 0) return { type: 'flashcard.shuffle' }
  if (call.name === 'flashcard_grade' && onlyKeys(args, ['grade']) && ['again', 'hard', 'good', 'easy'].includes(String(args.grade))) return { type: 'flashcard.grade', grade: args.grade as Extract<VoiceAction, { type: 'flashcard.grade' }>['grade'] }
  if (call.name === 'flashcard_hint' && onlyKeys(args, ['confirmed']) && args.confirmed === true) return { type: 'materialFlashcard.hint', confirmed: true }
  throw new Error(`Invalid arguments for voice tool ${call.name}.`)
}

export function createRealtimeFunctionHandler(
  onAction: ((action: VoiceAction) => VoiceActionResult | Promise<VoiceActionResult>) | undefined,
  sendOutput: (callId: string, result: VoiceActionResult) => void,
  actionTimeoutMs = 10_000,
) {
  const handled = new Set<string>()
  return async (event: unknown) => {
    const calls: FunctionCall[] = []
    for (const call of realtimeFunctionCalls(event)) {
      if (handled.has(call.callId)) continue
      handled.add(call.callId)
      calls.push(call)
    }
    for (const call of calls) {
      let result: VoiceActionResult
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        if (!onAction) throw new Error('This voice action is not available in the current view.')
        result = await Promise.race([
          Promise.resolve().then(() => onAction(voiceActionFromCall(call))),
          new Promise<never>((_, reject) => { timeout = globalThis.setTimeout(() => reject(new Error('The voice action timed out.')), actionTimeoutMs) }),
        ])
      } catch (error) {
        result = { ok: false, error: error instanceof Error ? error.message : 'The voice action failed.' }
      } finally {
        if (timeout !== undefined) globalThis.clearTimeout(timeout)
      }
      sendOutput(call.callId, result)
    }
    return calls.length > 0
  }
}

export function createLatestValueQueue<T>(isOpen: () => boolean, send: (value: T) => void) {
  let queued: T | undefined
  return {
    push(value: T) {
      if (isOpen()) send(value)
      else queued = value
    },
    flush() {
      if (queued === undefined || !isOpen()) return
      const value = queued
      queued = undefined
      send(value)
    },
  }
}

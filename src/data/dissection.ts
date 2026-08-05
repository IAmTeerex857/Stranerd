export type DissectionSnapshot = {
  hiddenIds: string[]
  transparentIds: string[]
  offsets: Record<string, [number, number, number]>
  isolate: boolean
}

export type DissectionState = DissectionSnapshot & { history: DissectionSnapshot[] }

export type DissectionActionType = 'select' | 'hide' | 'show' | 'isolate' | 'transparent' | 'move' | 'reset'

export type DissectionActionContext = {
  mode: 'dissection'
  action: DissectionActionType
  system: string
  structureIds: string[]
  structures: string[]
  hiddenStructures: string[]
  visibleNeighbors: string[]
  guidedStep?: string
}

export type GuidedDissectionStep = {
  action: DissectionActionType
  targetIds: string[]
  prompt: string
  success: string
}

export const digestivePancreasSequence = {
  id: 'digestive-pancreas-pathway',
  title: 'Expose the pancreatic pathway',
  steps: [
    {
      action: 'hide',
      targetIds: ['anatomy:organs:stomach'],
      prompt: 'Select and hide the stomach to expose structures behind it.',
      success: 'The stomach is hidden, revealing the pancreas posterior to it.',
    },
    {
      action: 'isolate',
      targetIds: ['anatomy:organs:pancreas'],
      prompt: 'Select the pancreas and isolate it.',
      success: 'The pancreas is isolated for focused inspection.',
    },
    {
      action: 'select',
      targetIds: ['anatomy:organs:duodenum'],
      prompt: 'Select the structure that receives pancreatic secretions.',
      success: 'The duodenum receives pancreatic secretions through the pancreatic duct.',
    },
  ] satisfies GuidedDissectionStep[],
} as const

export const digestiveDissectionQuiz = {
  question: 'After exposing the pancreas, which structure receives its digestive secretions?',
  options: ['Stomach', 'Duodenum', 'Transverse colon', 'Gallbladder'],
  correctIndex: 1,
  explanation: 'The pancreatic duct empties into the duodenum, where pancreatic enzymes and bicarbonate join chyme from the stomach.',
} as const

export function guidedStepComplete(step: GuidedDissectionStep, action: DissectionActionType, structureIds: string[]) {
  return step.action === action && step.targetIds.every((id) => structureIds.includes(id))
}

export function anatomyMovementId(structureId: string, meshId: string) {
  return `${structureId}::${meshId}`
}

export type DissectionAction =
  | { type: 'hide'; ids: string[] }
  | { type: 'show'; ids: string[] }
  | { type: 'show-all' }
  | { type: 'toggle-transparent'; ids: string[] }
  | { type: 'toggle-isolate' }
  | { type: 'begin-move' }
  | { type: 'set-offset'; id: string; offset: [number, number, number] }
  | { type: 'reset' }
  | { type: 'clear' }
  | { type: 'undo' }

const emptySnapshot = (): DissectionSnapshot => ({ hiddenIds: [], transparentIds: [], offsets: {}, isolate: false })

export function createDissectionState(): DissectionState {
  return { ...emptySnapshot(), history: [] }
}

function snapshot(state: DissectionState): DissectionSnapshot {
  return { hiddenIds: state.hiddenIds, transparentIds: state.transparentIds, offsets: state.offsets, isolate: state.isolate }
}

function update(state: DissectionState, next: DissectionSnapshot): DissectionState {
  if (JSON.stringify(snapshot(state)) === JSON.stringify(next)) return state
  return { ...next, history: [...state.history.slice(-29), snapshot(state)] }
}

export function dissectionReducer(state: DissectionState, action: DissectionAction): DissectionState {
  if (action.type === 'clear') return createDissectionState()
  if (action.type === 'undo') {
    const previous = state.history.at(-1)
    return previous ? { ...previous, history: state.history.slice(0, -1) } : state
  }
  if (action.type === 'reset') return update(state, emptySnapshot())
  if (action.type === 'begin-move') return { ...state, history: [...state.history.slice(-29), snapshot(state)] }
  if (action.type === 'set-offset') return { ...state, offsets: { ...state.offsets, [action.id]: action.offset } }
  if (action.type === 'hide') return update(state, { ...snapshot(state), hiddenIds: [...new Set([...state.hiddenIds, ...action.ids])] })
  if (action.type === 'show') return update(state, { ...snapshot(state), hiddenIds: state.hiddenIds.filter((id) => !action.ids.includes(id)) })
  if (action.type === 'show-all') return update(state, { ...snapshot(state), hiddenIds: [] })
  if (action.type === 'toggle-isolate') return update(state, { ...snapshot(state), isolate: !state.isolate })
  const allTransparent = action.ids.length > 0 && action.ids.every((id) => state.transparentIds.includes(id))
  return update(state, {
    ...snapshot(state),
    transparentIds: allTransparent
      ? state.transparentIds.filter((id) => !action.ids.includes(id))
      : [...new Set([...state.transparentIds, ...action.ids])],
  })
}

export function digestiveStructureGroup(label: string) {
  const value = label.toLowerCase()
  if (/liver|gallbladder|bile/.test(value)) return 'Hepatobiliary'
  if (/pancrea/.test(value)) return 'Pancreas and ducts'
  if (/duodenum|jejunum|colon|taenia|appendix/.test(value)) return 'Intestines'
  if (/oesophagus|esophagus|stomach|pharynx/.test(value)) return 'Upper tract'
  return 'Oral and salivary'
}

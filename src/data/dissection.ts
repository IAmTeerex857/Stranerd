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
  | { type: 'set-isolate'; value: boolean }
  | { type: 'begin-move' }
  | { type: 'set-offset'; id: string; offset: [number, number, number] }
  | { type: 'reset' }
  | { type: 'clear' }
  | { type: 'undo' }

const emptySnapshot = (): DissectionSnapshot => ({ hiddenIds: [], transparentIds: [], offsets: {}, isolate: false })

export function createDissectionState(initial?: DissectionSnapshot): DissectionState {
  return { ...(initial ?? emptySnapshot()), history: [] }
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
  if (action.type === 'set-isolate') return update(state, { ...snapshot(state), isolate: action.value })
  const allTransparent = action.ids.length > 0 && action.ids.every((id) => state.transparentIds.includes(id))
  return update(state, {
    ...snapshot(state),
    transparentIds: allTransparent
      ? state.transparentIds.filter((id) => !action.ids.includes(id))
      : [...new Set([...state.transparentIds, ...action.ids])],
  })
}

type StructureReference = { id: string; label: string; nodeId?: string }

export function normalizedStructureName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function resolveDissectionStructures<T extends StructureReference>(requested: string[], sources: readonly (readonly T[])[]): { structures: T[] } | { error: string } {
  const resolved: T[] = []
  for (const request of requested) {
    const normalized = normalizedStructureName(request)
    const matches = sources.map((source) => [...new Map(source.map((entry) => [entry.id, entry])).values()].filter((entry) => [entry.id, entry.nodeId, entry.label].some((value) => value !== undefined && normalizedStructureName(value) === normalized))).find((entries) => entries.length > 0) ?? []
    if (matches.length !== 1) return { error: matches.length === 0 ? `Structure not found: ${request}` : `Structure is ambiguous: ${request}` }
    if (!resolved.some((entry) => entry.id === matches[0].id)) resolved.push(matches[0])
  }
  return { structures: resolved }
}

export function separateStructureOffsets(ids: string[], distance = 0.45): Record<string, [number, number, number]> {
  if (ids.length < 2) return {}
  const span = distance * 2
  return Object.fromEntries(ids.map((id, index) => [id, [-distance + span * index / (ids.length - 1), 0, 0]]))
}

export function digestiveStructureGroup(label: string) {
  const value = label.toLowerCase()
  if (/liver|gallbladder|bile/.test(value)) return 'Hepatobiliary'
  if (/pancrea/.test(value)) return 'Pancreas and ducts'
  if (/duodenum|jejunum|colon|taenia|appendix/.test(value)) return 'Intestines'
  if (/oesophagus|esophagus|stomach|pharynx/.test(value)) return 'Upper tract'
  return 'Oral and salivary'
}

import type { ActiveNoteContext } from '../types/materials'

export const MAX_NOTE_SELECTION_LENGTH = 2_000

export function boundedNoteSelection(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE_SELECTION_LENGTH)
}

export function noteSelectionPrompt(action: 'explain' | 'ask', context: ActiveNoteContext, guidance = '') {
  const selection = boundedNoteSelection(context.selectedText)
  const direction = boundedNoteSelection(guidance).slice(0, 240)
  const location = `${context.subject}, ${context.section} (page${context.pageStart === context.pageEnd ? '' : 's'} ${context.pageStart}${context.pageEnd === context.pageStart ? '' : `-${context.pageEnd}`})`
  if (action === 'ask') return `${direction || 'Answer my question about this passage'} using the selected passage from ${location} as the primary context. Do not infer an answer key or introduce claims unsupported by the notes.\n\nSelected passage: “${selection}”`
  return `Explain the selected passage from ${location} in clear study language, including the key concept and why it matters. Ground the response in the notes and do not infer an answer key.\n\nSelected passage: “${selection}”`
}

type Rect = { left: number; right: number; top: number; bottom: number; width: number }

export function noteToolbarPosition(rect: Rect, workspaceLeft: number, workspaceRight: number, viewportHeight: number, toolbarWidth = 360, toolbarHeight = 112) {
  const margin = 12
  const leftEdge = workspaceLeft + margin
  const left = Math.min(workspaceRight - toolbarWidth - margin, Math.max(leftEdge, rect.left + rect.width / 2 - toolbarWidth / 2))
  const above = rect.top - toolbarHeight - 10
  const top = above >= margin ? above : Math.min(viewportHeight - toolbarHeight - margin, rect.bottom + 10)
  return { left: Math.max(leftEdge, left), top: Math.max(margin, top) }
}

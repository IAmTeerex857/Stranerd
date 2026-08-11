import { describe, expect, it } from 'vitest'
import { boundedNoteSelection, noteSelectionPrompt, noteToolbarPosition } from './noteSelection'

const context = { subject: 'Anatomy', subjectSlug: 'anatomy', releaseId: 'release', sectionId: 'section', section: 'Thorax', pageStart: 10, pageEnd: 12, selectedText: '  The   heart pumps blood.  ' }

describe('note selection helpers', () => {
  it('normalizes and bounds selected note text', () => {
    expect(boundedNoteSelection('  alpha\n beta ')).toBe('alpha beta')
    expect(boundedNoteSelection('x'.repeat(2_100))).toHaveLength(2_000)
  })

  it('builds grounded explain and ask prompts without mutation instructions', () => {
    expect(noteSelectionPrompt('explain', context)).toContain('Anatomy, Thorax (pages 10-12)')
    expect(noteSelectionPrompt('ask', context, 'How does this relate to flow?')).toContain('How does this relate to flow?')
    expect(noteSelectionPrompt('explain', context)).not.toMatch(/rewrite|replace|improve/i)
  })

  it('clamps the desktop toolbar inside the viewport', () => {
    expect(noteToolbarPosition({ left: -20, right: 20, top: 4, bottom: 24, width: 40 }, 400, 300, 200, 100)).toEqual({ left: 12, top: 34 })
  })
})

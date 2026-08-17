import { describe, expect, it } from 'vitest'
import { libraryGenerationCost, validateLibraryGeneration } from './library.js'

const userId = '10000000-0000-4000-8000-000000000001'
const base = { setId: '20000000-0000-4000-8000-000000000002', expectedVersion: null, title: 'Biology', outputType: 'practice', requestedCount: 10 }

describe('library validation', () => {
  it.each([[1, 5], [10, 5], [15, 10], [20, 10], [30, 15], [40, 20]])('prices %i items at %i credits', (count, cost) => {
    expect(libraryGenerationCost(count)).toBe(cost)
  })

  it('accepts homogeneous prompts', () => {
    expect(validateLibraryGeneration({ ...base, sourceCategory: 'prompt', sources: [{ text: 'cells' }, { category: 'prompt', text: 'tissues' }] }, userId)).toBeTruthy()
  })

  it('rejects mixed, oversized, and non-YouTube sources', () => {
    expect(validateLibraryGeneration({ ...base, sourceCategory: 'prompt', sources: [{ text: 'ok' }, { category: 'link', text: 'mixed' }] }, userId)).toBeUndefined()
    expect(validateLibraryGeneration({ ...base, sourceCategory: 'prompt', sources: Array.from({ length: 11 }, () => ({ text: 'x' })) }, userId)).toBeUndefined()
    expect(validateLibraryGeneration({ ...base, sourceCategory: 'youtube', sources: [{ url: 'https://example.com/video' }] }, userId)).toBeUndefined()
  })

  it('validates private upload ownership, MIME type, and size', () => {
    const source = { storagePath: `${userId}/input.pdf`, fileName: 'input.pdf', mimeType: 'application/pdf', byteSize: 100 }
    expect(validateLibraryGeneration({ ...base, sourceCategory: 'document', sources: [source] }, userId)).toBeTruthy()
    expect(validateLibraryGeneration({ ...base, sourceCategory: 'document', sources: [{ ...source, storagePath: 'another-user/input.pdf' }] }, userId)).toBeUndefined()
    expect(validateLibraryGeneration({ ...base, sourceCategory: 'document', sources: [{ ...source, mimeType: 'text/html' }] }, userId)).toBeUndefined()
  })
})

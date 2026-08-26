import { describe, expect, it } from 'vitest'
import { anatomyModels } from '../src/data/models.js'
import { serverAnatomyCatalog } from './anatomyCatalog.js'

describe('server anatomy catalog', () => {
  it('authorizes every production model used by text and voice features', () => {
    expect(serverAnatomyCatalog).toHaveLength(anatomyModels.length)
    expect(new Set(serverAnatomyCatalog.map((model) => model.id))).toEqual(new Set(anatomyModels.map((model) => model.id)))
  })
})

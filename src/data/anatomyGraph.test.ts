import { describe, expect, it } from 'vitest'
import { anatomyGraph, anatomyLayers, anatomyNodeId, conditions, createMeshSelection, formatStructureName, totalNamedNodes } from './anatomyGraph'

describe('segmented anatomy graph', () => {
  it('publishes a versioned, unique system manifest', () => {
    expect(anatomyGraph.schemaVersion).toBe(1)
    expect(anatomyGraph.contentVersion).toMatch(/^\d{4}\.\d{2}/)
    expect(new Set(anatomyLayers.map((layer) => layer.id)).size).toBe(anatomyLayers.length)
    expect(totalNamedNodes).toBeGreaterThan(2500)
  })

  it('creates stable structure IDs and bounded condition context', () => {
    expect(anatomyNodeId('organs', 'Kidney.l')).toBe('anatomy:organs:kidney-left')
    const selection = createMeshSelection('organs', 'Kidney.l')
    expect(selection.label).toBe('Left Kidney')
    expect(selection.conditions?.some((condition) => condition.id === 'chronic-kidney-disease')).toBe(true)
  })

  it('removes runtime instance suffixes before resolving laterality', () => {
    expect(formatStructureName('Medulla oblongata.l 1 Instance')).toBe('Left Medulla Oblongata')
    expect(formatStructureName('Anterior quadrangular lobule.r_2_INSTANCE')).toBe('Right Anterior Quadrangular Lobule')
  })

  it('keeps condition identifiers unique', () => {
    expect(new Set(conditions.map((condition) => condition.id)).size).toBe(conditions.length)
  })
})

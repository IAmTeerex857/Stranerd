import { describe, expect, it } from 'vitest'
import { evaluateExact, lessons } from './lessons'
import { models } from './models'

describe('deterministic anatomy evaluation', () => {
  it('passes only an exact set regardless of order', () => {
    expect(evaluateExact(['a', 'b'], { selectedIds: ['b', 'a'] }).pass).toBe(true)
  })

  it('rejects missing and extra structures', () => {
    expect(evaluateExact(['a', 'b'], { selectedIds: ['a'] }).pass).toBe(false)
    expect(evaluateExact(['a'], { selectedIds: ['a', 'b'] }).pass).toBe(false)
  })

  it('keeps every authored task executable', () => {
    for (const task of lessons) expect(task.evaluate({ selectedIds: task.targetIds }).pass).toBe(true)
  })

  it('provides at least two tasks per model with valid selection targets', () => {
    for (const model of models) {
      const tasks = lessons.filter((task) => task.id.startsWith(`${model.id}-`))
      const hotspotIds = new Set(model.hotspots.map((hotspot) => hotspot.id))
      expect(tasks.length).toBeGreaterThanOrEqual(2)
      for (const task of tasks) {
        expect(task.targetIds.length).toBeGreaterThan(0)
        for (const targetId of task.targetIds) {
          const validMeshTarget = model.viewer === 'segmented-body' && targetId.startsWith('anatomy:')
          expect(hotspotIds.has(targetId) || validMeshTarget).toBe(true)
        }
      }
    }
  })

  it('keeps the streamlined specimen catalog complete', () => {
    expect(models.flatMap((model) => model.variants)).toHaveLength(44)
    for (const model of models) expect(model.variants[0].file).toBe(model.file)
  })

  it('orders realistic, interactive, and alternate specimens consistently', () => {
    const realisticIds = new Set(['heart', 'brain', 'lungs', 'kidney', 'eye', 'liver', 'skin', 'digestive-system'])
    expect(models.some((model) => model.id === 'intestine')).toBe(false)
    for (const model of models.filter((entry) => realisticIds.has(entry.id))) {
      expect(model.variants[0].label).toBe('Primary specimen')
      expect(model.variants[1].label).toBe('Interactive specimen')
      expect(model.variants.slice(2).every((variant) => variant.label.startsWith('Other specimen'))).toBe(true)
    }
  })
})

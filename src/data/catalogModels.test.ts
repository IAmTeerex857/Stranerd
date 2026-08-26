import { existsSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { anatomyModels, modelCategories, models } from './models'

describe('production anatomy catalog', () => {
  it('organizes every direct-click model into one ordered category', () => {
    expect(modelCategories.map((category) => category.label)).toEqual([
      'Whole Body', 'Organs', 'Body Systems', 'Head & Neck', 'Thorax & Abdomen', 'Pelvis & Perineum', 'Upper Limb', 'Lower Limb',
    ])
    expect(anatomyModels).toHaveLength(58)
    expect(new Set(anatomyModels.map((model) => model.id)).size).toBe(anatomyModels.length)
    expect(modelCategories.flatMap((category) => category.models.map((model) => model.id))).toEqual(anatomyModels.map((model) => model.id))
  })

  it('keeps the ten authored learning subjects separate from exploration additions', () => {
    expect(models).toHaveLength(10)
    expect(models.every((model) => anatomyModels.includes(model))).toBe(true)
  })

  it('ships every promoted catalog asset referenced by the expanded models', () => {
    const manifest = JSON.parse(readFileSync('public/models/catalog/manifest.json', 'utf8')) as { assets: { file: string; bytes: number }[] }
    const promoted = new Set(manifest.assets.map((asset) => asset.file.replace('/models/', '')))
    const referenced = new Set(anatomyModels.flatMap((model) => model.variants.map((variant) => variant.file)).filter((file) => file.startsWith('catalog/')))
    expect(promoted).toEqual(referenced)
    for (const file of promoted) {
      const path = `public/models/${file}`
      expect(existsSync(path), `${path} is missing`).toBe(true)
      expect(statSync(path).size).toBeGreaterThan(0)
    }
  })

  it('makes every expanded model selectable and dissectible', () => {
    for (const model of anatomyModels.filter((entry) => !models.includes(entry))) {
      expect(model.variants).toHaveLength(1)
      expect(model.variants[0].segmentedSystem).toBeTruthy()
    }
  })
})

import { describe, expect, it } from 'vitest'
import manifest from './anatomyAssetManifest.json'
import { anatomyActivities } from './activities'

describe('segmented anatomy asset manifest', () => {
  it('contains unique verified IDs for every segmented specimen and body layer', () => {
    expect(manifest.assets).toHaveLength(15)
    expect(manifest.assets.reduce((total, asset) => total + asset.structureIds.length, 0)).toBeGreaterThan(3000)
    for (const asset of manifest.assets) {
      expect(asset.file.endsWith('.glb')).toBe(true)
      expect(asset.structureIds.length).toBeGreaterThan(0)
      expect(new Set(asset.structureIds).size).toBe(asset.structureIds.length)
      expect(asset.structureIds.every((id) => id.startsWith('anatomy:') || id.startsWith('http'))).toBe(true)
    }
  })

  it('resolves every Lab action target in the GLB used by that activity', () => {
    const assets = new Map(manifest.assets.map((asset) => [asset.file, new Set(asset.structureIds)]))
    for (const activity of anatomyActivities) {
      for (const step of activity.steps) {
        if (step.kind !== 'action') continue
        for (const targetId of step.targetIds) {
          const systemId = targetId.split(':')[1]
          const file = activity.modelId === 'anatomy' ? `/models/body/${systemId}.glb` : `/models/${activity.modelId}-segmented.glb`
          expect(assets.get(file), `${file} is not represented in the manifest`).toBeDefined()
          expect(assets.get(file)?.has(targetId), `${targetId} does not resolve in ${file}`).toBe(true)
        }
      }
    }
  })

  it('uses runtime left-side normalization for audited selectable structures', () => {
    const ids = new Set(manifest.assets.flatMap((asset) => asset.structureIds))
    for (const id of [
      'anatomy:organs:kidney-left',
      'anatomy:nervous:cornea-left',
      'anatomy:skeleton:femur-left',
      'anatomy:skin:anterior-region-of-forearm-left',
      'anatomy:organs:left-main-bronchus',
      'anatomy:nervous:white-matter-of-spinal-cord',
    ]) expect(ids.has(id), `${id} is missing`).toBe(true)
  })
})

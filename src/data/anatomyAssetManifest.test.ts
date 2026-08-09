import { describe, expect, it } from 'vitest'
import manifest from './anatomyAssetManifest.json'

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
})

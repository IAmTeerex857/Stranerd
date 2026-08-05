import { describe, expect, it } from 'vitest'
import { segmentedMaterialProfile } from './anatomyMaterials'

describe('segmented anatomy materials', () => {
  it('renders optical eye structures transparently without depth occlusion', () => {
    for (const name of ['Cornea.l', 'Lens.r', 'Vitreous body.l', 'Anterior chamber of eyeball.r']) {
      const profile = segmentedMaterialProfile(name, 'nervous')
      expect(profile.opacity).toBeLessThan(0.5)
      expect(profile.depthWrite).toBe(false)
      expect(profile.doubleSided).toBe(true)
    }
  })

  it('keeps pigmented and neural eye tissues opaque and distinct', () => {
    const sclera = segmentedMaterialProfile('Sclera.r', 'nervous')
    const iris = segmentedMaterialProfile('Iris.r', 'nervous')
    const retina = segmentedMaterialProfile('Retina.r', 'nervous')
    const opticNerve = segmentedMaterialProfile('Optic nerve (II).r', 'nervous')

    expect([sclera, iris, retina, opticNerve].every((profile) => profile.opacity === 1 && profile.depthWrite)).toBe(true)
    expect(new Set([sclera.color, iris.color, retina.color, opticNerve.color]).size).toBe(4)
  })

  it('preserves established non-eye anatomy colors', () => {
    expect(segmentedMaterialProfile('Liver', 'organs').color).toBe('#8f4c43')
    expect(segmentedMaterialProfile('Ascending aorta', 'cardiovascular').color).toBe('#d75a61')
  })
})

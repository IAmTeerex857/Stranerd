import type { AnatomySystemId } from '../types'

export type SegmentedMaterialProfile = {
  color: string
  roughness: number
  metalness: number
  opacity: number
  depthWrite: boolean
  renderOrder: number
  doubleSided?: boolean
}

const tissue = (color: string, roughness = 0.62): SegmentedMaterialProfile => ({
  color,
  roughness,
  metalness: 0,
  opacity: 1,
  depthWrite: true,
  renderOrder: 0,
})

const optical = (color: string, opacity: number, renderOrder: number): SegmentedMaterialProfile => ({
  color,
  roughness: 0.08,
  metalness: 0,
  opacity,
  depthWrite: false,
  renderOrder,
  doubleSided: true,
})

export function segmentedMaterialProfile(name: string, systemId: AnatomySystemId): SegmentedMaterialProfile {
  const value = name.toLowerCase()
  if (systemId === 'skin') return tissue(/hair|eyebrow|eyelash/.test(value) ? '#5b4035' : '#d9a58f')
  if (systemId === 'nervous') {
    if (/cornea/.test(value)) return optical('#bfe8ef', 0.24, 8)
    if (/\blens\b/.test(value)) return optical('#dcebd5', 0.38, 7)
    if (/vitreous body/.test(value)) return optical('#a9dbe5', 0.1, 6)
    if (/chamber of eyeball/.test(value)) return optical('#8fcbd9', 0.08, 5)
    if (/segment of eyeball/.test(value)) return optical('#7fb7c7', 0.055, 4)
    if (/\bsclera\b/.test(value)) return tissue('#e6e0d3', 0.38)
    if (/\biris\b/.test(value)) return tissue('#4b8190', 0.3)
    if (/\bretina\b/.test(value)) return tissue('#a84f48', 0.48)
    if (/zonular|suspensory ligament/.test(value)) return tissue('#d9cfb0', 0.45)
    if (/lacrimal gland/.test(value)) return tissue('#c98282', 0.52)
    if (/lacrimal|nasolacrimal/.test(value)) return tissue('#d9b59f', 0.45)
    if (/optic|nerve|tract|fibre|funicul|plexus/.test(value)) return tissue('#edc75f', 0.56)
    if (/eye|eyeball/.test(value)) return tissue('#e8ddd3', 0.5)
    if (/cerebell/.test(value)) return tissue('#c98272')
    if (/brainstem|midbrain|pons|medulla/.test(value)) return tissue('#c88f6c')
    if (/frontal/.test(value)) return tissue('#d47c72')
    if (/parietal/.test(value)) return tissue('#c98b67')
    if (/temporal/.test(value)) return tissue('#a9798e')
    if (/occipital/.test(value)) return tissue('#8d78a8')
    return tissue('#d19a83')
  }
  if (systemId === 'organs') {
    if (/lung|pleura/.test(value)) return tissue('#d9919a')
    if (/bronch|trachea|larynx/.test(value)) return tissue('#c6d4d7')
    if (/kidney|renal/.test(value)) return tissue('#a95458')
    if (/ureter|urethra|bladder/.test(value)) return tissue('#d8b56f')
    if (/liver|hepatic/.test(value)) return tissue('#8f4c43')
    if (/gallbladder|bile/.test(value)) return tissue('#77a65a')
    if (/pancreas/.test(value)) return tissue('#d7a56b')
    if (/stomach/.test(value)) return tissue('#ca7f79')
    if (/colon|intestin|duodenum|jejunum|ileum|cecum|appendix/.test(value)) return tissue('#c98e75')
    if (/oesophagus|esophagus|pharynx|mouth/.test(value)) return tissue('#b86d6c')
    return tissue('#bd776d')
  }
  if (/vein|vena cava|coronary sinus/.test(value)) return tissue('#4f83d1')
  if (/artery|aorta|pulmonary trunk/.test(value)) return tissue('#d75a61')
  if (/valve|leaflet/.test(value)) return tissue('#e8d8b8')
  if (/atrium/.test(value)) return tissue('#b94f68')
  if (/ventricle|papillary|heart/.test(value)) return tissue('#c85f58')
  return tissue('#d07a72')
}

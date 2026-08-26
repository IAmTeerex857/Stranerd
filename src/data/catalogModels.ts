import type { AnatomySystemId, ModelCategoryId, ModelEntry } from '../types.js'

export type ModelCategory = { id: ModelCategoryId; label: string; modelIds: string[] }

type CatalogDefinition = {
  id: string
  name: string
  categoryId: ModelCategoryId
  system: string
  region: string
  file: string
  segmentedSystem: AnatomySystemId
  focus?: string
}

const catalogFile = (name: string) => `catalog/${name}.glb`

const definitions: CatalogDefinition[] = [
  { id: 'body-regions', name: 'Body Regions', categoryId: 'whole-body', system: 'Regional Anatomy', region: 'Whole body', file: catalogFile('z-anatomy-body-regions'), segmentedSystem: 'organs' },

  { id: 'inner-ear', name: 'Inner Ear', categoryId: 'organs', system: 'Sensory', region: 'Temporal bone', file: catalogFile('openanatomy-inner-ear'), segmentedSystem: 'nervous' },

  { id: 'skeletal-system', name: 'Skeletal System', categoryId: 'body-systems', system: 'Skeletal', region: 'Whole body', file: 'body/skeleton.glb', segmentedSystem: 'skeleton' },
  { id: 'joints', name: 'Joints', categoryId: 'body-systems', system: 'Musculoskeletal', region: 'Whole body', file: catalogFile('z-anatomy-joints'), segmentedSystem: 'skeleton' },
  { id: 'muscular-system', name: 'Muscular System', categoryId: 'body-systems', system: 'Muscular', region: 'Whole body', file: 'body/muscular.glb', segmentedSystem: 'muscular' },
  { id: 'cardiovascular-system', name: 'Cardiovascular System', categoryId: 'body-systems', system: 'Cardiovascular', region: 'Whole body', file: 'body/cardiovascular.glb', segmentedSystem: 'cardiovascular' },
  { id: 'lymphatic-system', name: 'Lymphatic System', categoryId: 'body-systems', system: 'Lymphatic', region: 'Whole body', file: catalogFile('z-anatomy-lymphoid-organs'), segmentedSystem: 'organs' },
  { id: 'respiratory-system', name: 'Respiratory System', categoryId: 'body-systems', system: 'Respiratory', region: 'Whole body', file: catalogFile('bodyparts3d-respiratory'), segmentedSystem: 'organs' },
  { id: 'visceral-organs', name: 'Visceral Organs', categoryId: 'body-systems', system: 'Visceral', region: 'Thorax, abdomen and pelvis', file: 'body/organs.glb', segmentedSystem: 'organs' },

  { id: 'brain-atlas', name: 'Brain Atlas', categoryId: 'head-neck', system: 'Nervous', region: 'Head', file: catalogFile('openanatomy-brain'), segmentedSystem: 'nervous' },
  { id: 'skull', name: 'Skull', categoryId: 'head-neck', system: 'Skeletal', region: 'Head', file: catalogFile('open3dmodel-overview-skull'), segmentedSystem: 'skeleton' },
  { id: 'colored-skull', name: 'Colored Skull', categoryId: 'head-neck', system: 'Skeletal', region: 'Head', file: catalogFile('open3dmodel-overview-colored-skull'), segmentedSystem: 'skeleton' },
  { id: 'exploded-skull', name: 'Exploded Skull', categoryId: 'head-neck', system: 'Skeletal', region: 'Head', file: catalogFile('open3dmodel-exploded-skull'), segmentedSystem: 'skeleton' },
  { id: 'skull-base', name: 'Skull Base', categoryId: 'head-neck', system: 'Skeletal', region: 'Head', file: catalogFile('open3dmodel-colored-skull-base'), segmentedSystem: 'skeleton' },
  { id: 'head-neck-atlas', name: 'Head & Neck Atlas', categoryId: 'head-neck', system: 'Regional Anatomy', region: 'Head and neck', file: catalogFile('openanatomy-head-neck'), segmentedSystem: 'organs' },
  { id: 'inner-ear-atlas', name: 'Inner Ear Atlas', categoryId: 'head-neck', system: 'Sensory', region: 'Temporal bone', file: catalogFile('openanatomy-inner-ear'), segmentedSystem: 'nervous' },

  { id: 'thorax', name: 'Thorax', categoryId: 'thorax-abdomen', system: 'Regional Anatomy', region: 'Thorax', file: catalogFile('openanatomy-thorax'), segmentedSystem: 'organs' },
  { id: 'abdominal-atlas', name: 'Abdominal Atlas', categoryId: 'thorax-abdomen', system: 'Regional Anatomy', region: 'Abdomen', file: catalogFile('openanatomy-abdomen'), segmentedSystem: 'organs' },
  { id: 'liver-segments', name: 'Liver Segments', categoryId: 'thorax-abdomen', system: 'Digestive', region: 'Right upper abdomen', file: catalogFile('openanatomy-liver'), segmentedSystem: 'organs' },
  { id: 'thorax-abdominal-muscles', name: 'Thorax & Abdominal Muscles', categoryId: 'thorax-abdomen', system: 'Muscular', region: 'Trunk', file: catalogFile('open3dmodel-muscles-thorax-abdomen'), segmentedSystem: 'muscular' },
  { id: 'muscle-origins-insertions', name: 'Muscle Origins & Insertions', categoryId: 'thorax-abdomen', system: 'Muscular', region: 'Trunk', file: catalogFile('open3dmodel-insertions-and-origins'), segmentedSystem: 'muscular' },
  { id: 'inguinal-canal', name: 'Inguinal Canal', categoryId: 'thorax-abdomen', system: 'Regional Anatomy', region: 'Lower abdominal wall', file: catalogFile('open3dmodel-inguinal-canal'), segmentedSystem: 'organs' },
  { id: 'inguinal-ligament', name: 'Inguinal Ligament', categoryId: 'thorax-abdomen', system: 'Musculoskeletal', region: 'Groin', file: catalogFile('open3dmodel-inguinal-ligament'), segmentedSystem: 'muscular' },
  { id: 'hernia-anatomy', name: 'Hernia Anatomy', categoryId: 'thorax-abdomen', system: 'Regional Anatomy', region: 'Inguinal and femoral canals', file: catalogFile('open3dmodel-inguinal-and-femoral-canal-hernia-surgery'), segmentedSystem: 'organs' },

  { id: 'pelvic-floor', name: 'Pelvic Floor & Perineum', categoryId: 'pelvis-perineum', system: 'Regional Anatomy', region: 'Male pelvis and perineum', file: catalogFile('open3dmodel-pelvicfloor'), segmentedSystem: 'muscular' },

  { id: 'upper-limb', name: 'Complete Upper Limb', categoryId: 'upper-limb', system: 'Regional Anatomy', region: 'Upper limb', file: catalogFile('open3dmodel-upper-limb'), segmentedSystem: 'muscular' },
  { id: 'shoulder', name: 'Shoulder', categoryId: 'upper-limb', system: 'Musculoskeletal', region: 'Shoulder', file: catalogFile('open3dmodel-zone-shoulder'), segmentedSystem: 'muscular' },
  { id: 'rotator-cuff', name: 'Rotator Cuff', categoryId: 'upper-limb', system: 'Muscular', region: 'Shoulder', file: catalogFile('open3dmodel-rotator-cuff'), segmentedSystem: 'muscular' },
  { id: 'arm', name: 'Arm', categoryId: 'upper-limb', system: 'Muscular', region: 'Arm', file: catalogFile('open3dmodel-upper-limb-arm-muscles'), segmentedSystem: 'muscular' },
  { id: 'elbow', name: 'Elbow', categoryId: 'upper-limb', system: 'Musculoskeletal', region: 'Elbow', file: catalogFile('open3dmodel-zone-elbow'), segmentedSystem: 'muscular' },
  { id: 'forearm', name: 'Forearm', categoryId: 'upper-limb', system: 'Muscular', region: 'Forearm', file: catalogFile('open3dmodel-upper-limb-forearm-anterior-compartment-muscles'), segmentedSystem: 'muscular' },
  { id: 'hand', name: 'Hand', categoryId: 'upper-limb', system: 'Regional Anatomy', region: 'Hand', file: catalogFile('open3dmodel-hand'), segmentedSystem: 'muscular' },
  { id: 'hand-wrist-bones', name: 'Hand & Wrist Bones', categoryId: 'upper-limb', system: 'Skeletal', region: 'Hand and wrist', file: catalogFile('open3dmodel-hand-and-wrist-bones-and-cartilages'), segmentedSystem: 'skeleton' },
  { id: 'hand-wrist-joints', name: 'Hand & Wrist Joints', categoryId: 'upper-limb', system: 'Musculoskeletal', region: 'Hand and wrist', file: catalogFile('open3dmodel-hand-and-wrist-joints'), segmentedSystem: 'skeleton' },
  { id: 'shoulder-joints', name: 'Shoulder Joints', categoryId: 'upper-limb', system: 'Musculoskeletal', region: 'Shoulder', file: catalogFile('open3dmodel-shoulder-and-pectoral-girdle-joints'), segmentedSystem: 'skeleton' },
  { id: 'axio-appendicular-muscles', name: 'Axio-Appendicular Muscles', categoryId: 'upper-limb', system: 'Muscular', region: 'Shoulder and trunk', file: catalogFile('open3dmodel-upper-limb-axio-appendicular-muscles'), segmentedSystem: 'muscular' },
  { id: 'scapulohumeral-muscles', name: 'Scapulohumeral Muscles', categoryId: 'upper-limb', system: 'Muscular', region: 'Shoulder', file: catalogFile('open3dmodel-upper-limb-scapulohumeral-muscles'), segmentedSystem: 'muscular' },
  { id: 'brachial-plexus', name: 'Brachial Plexus', categoryId: 'upper-limb', system: 'Nervous', region: 'Shoulder and upper limb', file: catalogFile('open3dmodel-brachial-plexus-and-branches'), segmentedSystem: 'nervous' },
  { id: 'axillary-nerve', name: 'Axillary Nerve', categoryId: 'upper-limb', system: 'Nervous', region: 'Shoulder', file: catalogFile('open3dmodel-axillary-nerve'), segmentedSystem: 'nervous' },
  { id: 'radial-nerve', name: 'Radial Nerve', categoryId: 'upper-limb', system: 'Nervous', region: 'Upper limb', file: catalogFile('open3dmodel-radial-nerve'), segmentedSystem: 'nervous' },
  { id: 'ulnar-nerve', name: 'Ulnar Nerve', categoryId: 'upper-limb', system: 'Nervous', region: 'Upper limb', file: catalogFile('open3dmodel-ulnar-nerve'), segmentedSystem: 'nervous' },
  { id: 'median-nerve', name: 'Median Nerve', categoryId: 'upper-limb', system: 'Nervous', region: 'Upper limb', file: catalogFile('open3dmodel-median-nerve'), segmentedSystem: 'nervous' },
  { id: 'musculocutaneous-nerve', name: 'Musculocutaneous Nerve', categoryId: 'upper-limb', system: 'Nervous', region: 'Upper limb', file: catalogFile('open3dmodel-musculocutaneous-nerve'), segmentedSystem: 'nervous' },

  { id: 'lower-limb', name: 'Complete Lower Limb', categoryId: 'lower-limb', system: 'Regional Anatomy', region: 'Lower limb', file: catalogFile('open3dmodel-lower-limb'), segmentedSystem: 'muscular' },
  { id: 'hip', name: 'Hip', categoryId: 'lower-limb', system: 'Musculoskeletal', region: 'Hip', file: catalogFile('open3dmodel-zone-hip'), segmentedSystem: 'muscular' },
  { id: 'knee', name: 'Knee', categoryId: 'lower-limb', system: 'Musculoskeletal', region: 'Knee', file: catalogFile('open3dmodel-zone-knee'), segmentedSystem: 'muscular' },
  { id: 'knee-atlas', name: 'Knee Atlas', categoryId: 'lower-limb', system: 'Regional Anatomy', region: 'Knee', file: catalogFile('openanatomy-knee'), segmentedSystem: 'muscular' },
  { id: 'ankle', name: 'Ankle', categoryId: 'lower-limb', system: 'Musculoskeletal', region: 'Ankle', file: catalogFile('open3dmodel-zone-ankle'), segmentedSystem: 'muscular' },
]

const categoryOrder: Array<[ModelCategoryId, string, string[]]> = [
  ['whole-body', 'Whole Body', ['anatomy', 'body-regions']],
  ['organs', 'Organs', ['heart', 'brain', 'lungs', 'kidney', 'eye', 'inner-ear', 'liver', 'digestive-system']],
  ['body-systems', 'Body Systems', ['skeletal-system', 'joints', 'muscular-system', 'nervous-system', 'cardiovascular-system', 'lymphatic-system', 'respiratory-system', 'visceral-organs', 'skin']],
  ['head-neck', 'Head & Neck', ['brain-atlas', 'skull', 'colored-skull', 'exploded-skull', 'skull-base', 'head-neck-atlas', 'inner-ear-atlas']],
  ['thorax-abdomen', 'Thorax & Abdomen', ['thorax', 'abdominal-atlas', 'liver-segments', 'thorax-abdominal-muscles', 'muscle-origins-insertions', 'inguinal-canal', 'inguinal-ligament', 'hernia-anatomy']],
  ['pelvis-perineum', 'Pelvis & Perineum', ['pelvic-floor']],
  ['upper-limb', 'Upper Limb', ['upper-limb', 'shoulder', 'rotator-cuff', 'arm', 'elbow', 'forearm', 'hand', 'hand-wrist-bones', 'hand-wrist-joints', 'shoulder-joints', 'axio-appendicular-muscles', 'scapulohumeral-muscles', 'brachial-plexus', 'axillary-nerve', 'radial-nerve', 'ulnar-nerve', 'median-nerve', 'musculocutaneous-nerve']],
  ['lower-limb', 'Lower Limb', ['lower-limb', 'hip', 'knee', 'knee-atlas', 'ankle']],
]

const categoryFacts: Record<ModelCategoryId, string[]> = {
  'whole-body': ['Regional anatomy describes structures by their position and relationships.', 'Anatomical position provides a consistent directional reference.'],
  organs: ['Organ structure supports specialized physiological function.', 'Neighboring vessels, nerves, and tissues determine important anatomical relationships.'],
  'body-systems': ['Body systems coordinate structures distributed across multiple regions.', 'System anatomy connects local structures to whole-body function.'],
  'head-neck': ['Head and neck anatomy is densely organized around shared neurovascular pathways.', 'Bony landmarks provide essential orientation for adjacent soft tissues.'],
  'thorax-abdomen': ['Thoracic and abdominal organs are organized within connected cavities and fascial spaces.', 'Vessels and ducts link regional anatomy across the diaphragm.'],
  'pelvis-perineum': ['The pelvic floor supports pelvic viscera and contributes to continence.', 'Pelvic anatomy combines muscular, visceral, vascular, and neural structures.'],
  'upper-limb': ['Upper-limb function depends on coordinated joints, muscles, vessels, and peripheral nerves.', 'Regional anatomy follows structures from the shoulder into the hand.'],
  'lower-limb': ['Lower-limb anatomy supports weight bearing, balance, and locomotion.', 'Major joints coordinate mobility while transmitting load.'],
}

const standardCamera = { azimuth: 8, elevation: 6, distance: 4.8, minDistance: 1.3, maxDistance: 8, view: 'Anatomical overview' }

export const supplementalModels: ModelEntry[] = definitions.map((entry) => ({
  id: entry.id,
  categoryId: entry.categoryId,
  name: entry.name,
  scientificName: entry.name,
  system: entry.system,
  file: entry.file,
  variants: [{ id: 'interactive', label: 'Interactive specimen', file: entry.file, note: 'Named structures support selection and virtual dissection.', segmentedSystem: entry.segmentedSystem }],
  description: `An interactive ${entry.name.toLowerCase()} model for studying named structures and their spatial relationships.`,
  facts: categoryFacts[entry.categoryId],
  metadata: { region: entry.region, scale: 'Anatomical reference', focus: entry.focus ?? 'Structures and spatial relationships' },
  hotspots: [],
  anatomy: true,
  camera: standardCamera,
}))

export const modelCategoryDefinitions: ModelCategory[] = categoryOrder.map(([id, label, modelIds]) => ({ id, label, modelIds }))

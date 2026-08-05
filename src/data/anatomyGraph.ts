import type { AnatomyLayer, AnatomySystemId, ConditionRecord, Hotspot } from '../types'

export const anatomyGraph = {
  schemaVersion: 1,
  contentVersion: '2026.08-demo.1',
  sources: [
    { id: 'z-anatomy', label: 'Z-Anatomy segmented atlas' },
    { id: 'bodyparts3d', label: 'BodyParts3D / Anatomography' },
    { id: 'disease-ontology', label: 'Human Disease Ontology' },
  ],
} as const

export const anatomyLayers: AnatomyLayer[] = [
  { id: 'skin', label: 'Skin', file: '/models/body/skin.glb', color: '#dba58f', namedNodeCount: 288, directMeshCount: 254, defaultVisible: false },
  { id: 'muscular', label: 'Muscular', file: '/models/body/muscular.glb', color: '#ca5f5f', namedNodeCount: 777, directMeshCount: 672, defaultVisible: false },
  { id: 'skeleton', label: 'Skeleton', file: '/models/body/skeleton.glb', color: '#e9dfc2', namedNodeCount: 308, directMeshCount: 70, defaultVisible: true },
  { id: 'cardiovascular', label: 'Cardiovascular', file: '/models/body/cardiovascular.glb', color: '#d74f63', namedNodeCount: 699, directMeshCount: 430, defaultVisible: false },
  { id: 'nervous', label: 'Nervous', file: '/models/body/nervous.glb', color: '#f2c261', namedNodeCount: 663, directMeshCount: 492, defaultVisible: false },
  { id: 'organs', label: 'Organs', file: '/models/body/organs.glb', color: '#b17acf', namedNodeCount: 149, directMeshCount: 93, defaultVisible: true },
]

export const conditions: ConditionRecord[] = [
  { id: 'myocardial-infarction', label: 'Myocardial infarction', summary: 'Loss of blood flow injures heart muscle, usually after a coronary artery becomes blocked.', structureTerms: ['heart', 'coronary', 'myocard'] },
  { id: 'hypertension', label: 'Hypertension', summary: 'Persistently elevated arterial pressure increases strain on vessels, the heart, kidneys, and brain.', structureTerms: ['artery', 'aorta', 'heart', 'kidney', 'renal'] },
  { id: 'stroke', label: 'Stroke', summary: 'Interrupted or ruptured cerebral blood flow can rapidly injure brain tissue.', structureTerms: ['brain', 'cerebral', 'carotid', 'vertebral artery'] },
  { id: 'asthma', label: 'Asthma', summary: 'Inflammation and narrowing of the airways can restrict airflow through the lungs.', structureTerms: ['bronch', 'lung', 'trachea'] },
  { id: 'pneumonia', label: 'Pneumonia', summary: 'Infection and inflammation can fill pulmonary air spaces and impair gas exchange.', structureTerms: ['lung', 'pulmonary', 'alveol'] },
  { id: 'chronic-kidney-disease', label: 'Chronic kidney disease', summary: 'Progressive kidney damage reduces filtration and disrupts fluid and electrolyte balance.', structureTerms: ['kidney', 'renal', 'neph'] },
  { id: 'cirrhosis', label: 'Cirrhosis', summary: 'Long-term injury replaces functional liver tissue with fibrosis and regenerative nodules.', structureTerms: ['liver', 'hepatic', 'portal vein'] },
  { id: 'osteoporosis', label: 'Osteoporosis', summary: 'Reduced bone strength increases susceptibility to fractures.', structureTerms: ['bone', 'femur', 'vertebra', 'humerus', 'radius', 'ulna', 'tibia', 'fibula'] },
  { id: 'osteoarthritis', label: 'Osteoarthritis', summary: 'Degeneration of articular cartilage and adjacent bone can cause pain and reduced joint movement.', structureTerms: ['joint', 'cartilage', 'knee', 'hip', 'shoulder'] },
  { id: 'parkinsons-disease', label: "Parkinson's disease", summary: 'Loss of dopamine-producing neurons disrupts movement control networks.', structureTerms: ['substantia nigra', 'basal ganglia', 'brain'] },
  { id: 'appendicitis', label: 'Appendicitis', summary: 'Inflammation of the vermiform appendix can progress rapidly and requires urgent assessment.', structureTerms: ['appendix', 'cecum'] },
  { id: 'glaucoma', label: 'Glaucoma', summary: 'Progressive optic-nerve damage can lead to irreversible visual-field loss.', structureTerms: ['optic nerve', 'eye', 'retina'] },
]

const profiles: { terms: string[]; description: string }[] = [
  { terms: ['heart'], description: 'The heart is a muscular pump that drives pulmonary and systemic circulation through coordinated chambers, valves, and vessels.' },
  { terms: ['brain'], description: 'The brain integrates sensory information, movement, cognition, memory, and homeostatic control through specialized neural networks.' },
  { terms: ['kidney'], description: 'The kidney filters plasma, regulates fluid and electrolytes, supports acid-base balance, and contributes to blood-pressure control.' },
  { terms: ['liver'], description: 'The liver integrates metabolism, detoxification, protein synthesis, storage, and bile production.' },
  { terms: ['lung'], description: 'The lungs exchange oxygen and carbon dioxide across the alveolar-capillary interface.' },
  { terms: ['aorta'], description: 'The aorta is the main systemic artery carrying oxygenated blood from the left ventricle to the body.' },
  { terms: ['femur'], description: 'The femur is the major load-bearing bone of the thigh and forms part of both the hip and knee joints.' },
  { terms: ['spinal cord'], description: 'The spinal cord carries ascending sensory and descending motor pathways and coordinates segmental reflexes.' },
  { terms: ['optic nerve'], description: 'The optic nerve carries visual signals from retinal ganglion cells toward central visual pathways.' },
  { terms: ['trachea'], description: 'The trachea is a cartilage-supported conducting airway connecting the larynx to the main bronchi.' },
]

export const totalNamedNodes = anatomyLayers.reduce((total, layer) => total + layer.namedNodeCount, 0)
export const totalDirectMeshes = anatomyLayers.reduce((total, layer) => total + layer.directMeshCount, 0)

export function normalizeStructureName(rawName: string) {
  return rawName
    .replace(/(?:[._ -]?\d+)?[._ -]?instance$/i, '')
    .replace(/_\d+$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function anatomyNodeId(systemId: AnatomySystemId, rawName: string) {
  const slug = normalizeStructureName(rawName).toLowerCase().replace(/\.l$/i, '-left').replace(/\.r$/i, '-right').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  return `anatomy:${systemId}:${slug}`
}

export function formatStructureName(rawName: string) {
  const normalized = normalizeStructureName(rawName)
  const side = normalized.endsWith('.l') ? 'Left ' : normalized.endsWith('.r') ? 'Right ' : ''
  const clean = normalized.replace(/\.[lr]$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return `${side}${clean}`.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function conditionsForStructure(rawName: string) {
  const normalized = normalizeStructureName(rawName).toLowerCase()
  return conditions.filter((condition) => condition.structureTerms.some((term) => normalized.includes(term)))
}

export function createMeshSelection(systemId: AnatomySystemId, rawName: string): Hotspot {
  const layer = anatomyLayers.find((entry) => entry.id === systemId) ?? anatomyLayers[0]
  const normalized = normalizeStructureName(rawName).toLowerCase()
  const profile = profiles.find((entry) => entry.terms.some((term) => normalized.includes(term)))
  const label = formatStructureName(rawName)
  return {
    id: anatomyNodeId(systemId, rawName),
    nodeId: anatomyNodeId(systemId, rawName),
    label,
    detail: profile?.description ?? `${label} is a named structure in the ${layer.label.toLowerCase()} layer. Explore its position, neighboring anatomy, and related learning connections.`,
    position: [0, 0, 0],
    systemId,
    source: 'mesh',
    conditions: conditionsForStructure(rawName),
  }
}

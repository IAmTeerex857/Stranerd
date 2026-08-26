import { supplementalModels } from '../src/data/catalogModels.js'

export type ServerAnatomyModel = {
  id: string
  name: string
  system: string
  description: string
  facts: string[]
  diagramVariantId: string
  structures: { id: string; label: string; detail: string }[]
}

const coreAnatomyCatalog: ServerAnatomyModel[] = [
  { id: 'heart', name: 'Heart', system: 'Cardiovascular', description: 'Four-chambered muscular pump for pulmonary and systemic circulation.', facts: ['The left ventricle drives systemic circulation.', 'Coronary perfusion is greatest during diastole.'], diagramVariantId: 'primary', structures: [{ id: 'aorta', label: 'Ascending aorta', detail: 'Main arterial outflow from the left ventricle.' }, { id: 'left-ventricle', label: 'Left ventricle', detail: 'Thick-walled systemic pumping chamber.' }, { id: 'right-ventricle', label: 'Right ventricle', detail: 'Pumps blood toward the lungs.' }] },
  { id: 'brain', name: 'Brain', system: 'Nervous', description: 'Central organ for sensation, movement, cognition, and homeostasis.', facts: ['The cerebellum refines movement.', 'Cerebrospinal fluid supports buoyancy.'], diagramVariantId: 'primary', structures: [{ id: 'frontal-lobe', label: 'Frontal lobe', detail: 'Supports executive and motor functions.' }, { id: 'cerebellum', label: 'Cerebellum', detail: 'Coordinates movement and motor learning.' }, { id: 'temporal-lobe', label: 'Temporal lobe', detail: 'Supports auditory processing and memory.' }] },
  { id: 'lungs', name: 'Lungs', system: 'Respiratory', description: 'Paired organs for gas exchange.', facts: ['Type II pneumocytes produce surfactant.', 'Ventilation and perfusion must be matched.'], diagramVariantId: 'primary', structures: [{ id: 'right-upper-lobe', label: 'Right upper lobe', detail: 'Superior lobe of the right lung.' }, { id: 'left-lower-lobe', label: 'Left lower lobe', detail: 'Inferior lobe of the left lung.' }, { id: 'trachea', label: 'Trachea', detail: 'Cartilage-supported conducting airway.' }] },
  { id: 'kidney', name: 'Kidney', system: 'Urinary', description: 'Regulates fluid, electrolytes, acid-base balance, and waste excretion.', facts: ['The glomerulus begins plasma filtration.', 'Renin participates in blood-pressure regulation.'], diagramVariantId: 'primary', structures: [{ id: 'right-kidney', label: 'Right kidney', detail: 'Retroperitoneal filtration organ.' }, { id: 'left-kidney', label: 'Left kidney', detail: 'Paired urinary organ.' }, { id: 'ureter', label: 'Ureter', detail: 'Carries urine toward the bladder.' }] },
  { id: 'eye', name: 'Eye', system: 'Sensory', description: 'Optical and neural organ for vision.', facts: ['The cornea provides most refractive power.', 'Photoreceptors transduce light.'], diagramVariantId: 'primary', structures: [{ id: 'eyeball', label: 'Eyeball', detail: 'Globe containing optical and sensory structures.' }, { id: 'optic-nerve', label: 'Optic nerve', detail: 'Carries retinal output toward the brain.' }, { id: 'extraocular-muscles', label: 'Extraocular muscles', detail: 'Rotate and stabilize the eyeball.' }] },
  { id: 'liver', name: 'Liver', system: 'Digestive', description: 'Integrates metabolism, detoxification, bile production, and storage.', facts: ['Portal blood carries absorbed nutrients.', 'Bile supports lipid digestion.'], diagramVariantId: 'primary', structures: [{ id: 'right-lobe', label: 'Right lobe', detail: 'Largest anatomical liver lobe.' }, { id: 'porta-hepatis', label: 'Porta hepatis', detail: 'Gateway for vessels and bile ducts.' }, { id: 'gallbladder', label: 'Gallbladder', detail: 'Stores and concentrates bile.' }] },
  { id: 'nervous-system', name: 'Nervous System', system: 'Nervous', description: 'Body-wide central and peripheral signaling network.', facts: ['Afferent pathways carry sensory information toward the CNS.', 'Myelin increases conduction velocity.'], diagramVariantId: 'interactive', structures: [{ id: 'spinal-cord', label: 'Spinal cord', detail: 'Carries long tracts and coordinates reflexes.' }, { id: 'sciatic-nerve', label: 'Sciatic nerve', detail: 'Large peripheral nerve of the lower limb.' }] },
  { id: 'skin', name: 'Skin', system: 'Integumentary', description: 'Layered barrier for protection, sensation, and thermoregulation.', facts: ['The epidermis is avascular.', 'The dermis contains vessels and nerves.'], diagramVariantId: 'primary', structures: [{ id: 'epidermis', label: 'Epidermis', detail: 'Keratinized surface barrier.' }, { id: 'dermis', label: 'Dermis', detail: 'Vascular connective-tissue support.' }, { id: 'hypodermis', label: 'Hypodermis', detail: 'Subcutaneous anchoring tissue.' }] },
  { id: 'anatomy', name: 'Human Anatomy', system: 'Whole Body', description: 'Layered whole-body atlas of system relationships.', facts: ['Anatomical position standardizes terminology.', 'Regional anatomy emphasizes spatial relationships.'], diagramVariantId: 'v1', structures: [{ id: 'thorax', label: 'Thorax', detail: 'Region containing heart, lungs, and mediastinum.' }, { id: 'abdomen', label: 'Abdomen', detail: 'Region containing most digestive organs and kidneys.' }] },
  { id: 'digestive-system', name: 'Digestive System', system: 'Digestive', description: 'Integrated tract and organs for digestion, absorption, and elimination.', facts: ['Portal circulation sends absorbed nutrients to the liver.', 'Pancreatic enzymes enter the duodenum.'], diagramVariantId: 'primary', structures: [{ id: 'esophagus', label: 'Esophagus', detail: 'Muscular conduit to the stomach.' }, { id: 'stomach', label: 'Stomach', detail: 'Reservoir mixing food with gastric secretions.' }, { id: 'small-intestine', label: 'Small intestine', detail: 'Primary site of digestion and absorption.' }] },
]

export const serverAnatomyCatalog: ServerAnatomyModel[] = [
  ...coreAnatomyCatalog,
  ...supplementalModels.map((model) => ({
    id: model.id,
    name: model.name,
    system: model.system,
    description: model.description,
    facts: model.facts,
    diagramVariantId: model.variants[0].id,
    structures: [],
  })),
]

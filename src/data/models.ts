import type { Hotspot, ModelEntry } from '../types'

const spot = (id: string, label: string, detail: string, position: [number, number, number]): Hotspot => ({ id, label, detail, position })
const variants = (...files: string[]) => files.map((file, index) => ({
  id: `v${index + 1}`,
  label: index === 0 ? 'Primary specimen' : `Specimen ${index + 1}`,
  file,
  note: index === 0 ? 'Default optimized study model.' : 'Alternate authored geometry of the same study subject.',
}))

export const models: ModelEntry[] = [
  {
    id: 'heart', name: 'Heart', scientificName: 'Cor', system: 'Cardiovascular', file: 'heart.glb', variants: variants('heart.glb', 'heart-v2.glb', 'heart-v3.glb'), anatomy: true,
    description: 'A four-chambered muscular pump that maintains pulmonary and systemic circulation.',
    facts: ['The left ventricle has the thickest myocardium because it drives systemic circulation.', 'Cardiac output equals heart rate multiplied by stroke volume.', 'Coronary arteries perfuse the myocardium primarily during diastole.'],
    metadata: { region: 'Thorax / mediastinum', scale: '~12 cm long', focus: 'Chambers and great vessels' },
    hotspots: [
      spot('aorta', 'Ascending aorta', 'Carries oxygenated blood from the left ventricle toward systemic circulation.', [0.18, 1.2, 0.2]),
      spot('left-ventricle', 'Left ventricle', 'Thick-walled chamber generating pressure for the systemic circuit.', [0.35, -0.55, 0.48]),
      spot('right-ventricle', 'Right ventricle', 'Pumps deoxygenated blood into the pulmonary trunk.', [-0.38, -0.35, 0.52]),
      spot('pulmonary-artery', 'Pulmonary trunk', 'Divides into pulmonary arteries carrying blood toward both lungs.', [-0.42, 0.78, 0.36]),
      spot('superior-vena-cava', 'Superior vena cava', 'Returns venous blood from structures superior to the diaphragm.', [-0.7, 0.96, 0.08]),
      spot('left-atrium', 'Left atrium', 'Receives oxygenated blood from the pulmonary veins.', [0.58, 0.38, -0.12]),
      spot('coronary-vessels', 'Coronary vessels', 'Supply the metabolically active myocardium.', [0.05, -0.03, 0.72]),
    ],
  },
  {
    id: 'brain', name: 'Brain', scientificName: 'Encephalon', system: 'Nervous', file: 'brain.glb', variants: variants('brain.glb', 'brain-v2.glb', 'brain-v3.glb', 'brain-v4.glb', 'brain-v5.glb'), anatomy: true,
    description: 'The central integrative organ for sensation, movement, cognition, and homeostasis.',
    facts: ['The cerebral cortex is organized into functionally specialized networks.', 'The cerebellum refines movement and supports motor learning.', 'Cerebrospinal fluid provides buoyancy and chemical stability.'],
    metadata: { region: 'Cranial cavity', scale: '~1.3-1.4 kg adult', focus: 'Major divisions' },
    hotspots: [spot('frontal-lobe', 'Frontal lobe', 'Supports executive function and voluntary motor planning.', [-0.55, 0.25, 0.55]), spot('cerebellum', 'Cerebellum', 'Coordinates timing, precision, and motor adaptation.', [0.55, -0.62, -0.2]), spot('temporal-lobe', 'Temporal lobe', 'Participates in auditory processing and memory.', [-0.48, -0.28, 0.45])],
  },
  {
    id: 'lungs', name: 'Lungs', scientificName: 'Pulmones', system: 'Respiratory', file: 'lungs.glb', variants: variants('lungs.glb', 'lungs-v2.glb', 'lungs-v3.glb'), anatomy: true,
    description: 'Paired organs that exchange respiratory gases across the alveolar-capillary barrier.',
    facts: ['The right lung usually has three lobes; the left has two.', 'Type II pneumocytes produce surfactant.', 'Ventilation and perfusion must be matched for efficient gas exchange.'],
    metadata: { region: 'Thorax', scale: '~4-6 L total capacity', focus: 'Lobes and airway' },
    hotspots: [spot('right-upper-lobe', 'Right upper lobe', 'One of three lobes of the right lung.', [-0.58, 0.62, 0.3]), spot('left-lower-lobe', 'Left lower lobe', 'Extends inferiorly near the diaphragm.', [0.55, -0.52, 0.22]), spot('trachea', 'Trachea', 'Conducting airway supported by cartilaginous rings.', [0, 1.12, 0.12])],
  },
  {
    id: 'kidney', name: 'Kidney', scientificName: 'Ren', system: 'Urinary', file: 'kidney.glb', variants: variants('kidney.glb', 'kidney-v2.glb'), anatomy: true,
    description: 'A retroperitoneal organ regulating fluid, electrolytes, acid-base balance, and waste excretion.',
    facts: ['Each kidney contains roughly one million nephrons.', 'The glomerulus begins plasma ultrafiltration.', 'Renin participates in blood-pressure regulation.'],
    metadata: { region: 'Posterior abdomen', scale: '~11 cm long', focus: 'Cortex, medulla, hilum' },
    hotspots: [spot('renal-cortex', 'Renal cortex', 'Outer region containing glomeruli and convoluted tubules.', [-0.62, 0.3, 0.35]), spot('renal-medulla', 'Renal medulla', 'Inner region organized into renal pyramids.', [0.05, -0.18, 0.42]), spot('renal-pelvis', 'Renal pelvis', 'Funnel collecting urine before the ureter.', [0.62, 0.02, 0.15])],
  },
  {
    id: 'eye', name: 'Eye', scientificName: 'Oculus', system: 'Sensory', file: 'eye.glb', variants: variants('eye.glb', 'eye-v2.glb'), anatomy: true,
    description: 'An optical and neural organ that focuses light onto the retina for visual transduction.',
    facts: ['The cornea provides most of the eye’s refractive power.', 'Photoreceptors convert light into graded electrical signals.', 'The optic disc lacks photoreceptors.'],
    metadata: { region: 'Orbit', scale: '~24 mm diameter', focus: 'Optical pathway' },
    hotspots: [spot('cornea', 'Cornea', 'Transparent anterior surface with major refractive power.', [0, 0, 0.95]), spot('lens', 'Lens', 'Changes shape to adjust optical focus.', [0, 0, 0.35]), spot('optic-nerve', 'Optic nerve', 'Carries retinal ganglion-cell axons toward the brain.', [0, 0, -0.96])],
  },
  {
    id: 'intestine', name: 'Intestine', scientificName: 'Intestinum', system: 'Digestive', file: 'intestine.glb', variants: variants('intestine.glb', 'intestine-v2.glb'), anatomy: true,
    description: 'A long gastrointestinal segment specialized for digestion, absorption, and water recovery.',
    facts: ['Villi and microvilli greatly increase absorptive area.', 'Most nutrient absorption occurs in the small intestine.', 'The colon reclaims water and houses a dense microbiota.'],
    metadata: { region: 'Abdominopelvic cavity', scale: '~6 m small intestine', focus: 'Small and large bowel' },
    hotspots: [spot('jejunum', 'Jejunum', 'Middle small-bowel segment with prominent nutrient absorption.', [0.15, 0.25, 0.55]), spot('colon', 'Colon', 'Frames much of the small intestine and reabsorbs water.', [-0.68, 0.05, 0.3])],
  },
  {
    id: 'liver', name: 'Liver', scientificName: 'Hepar', system: 'Digestive', file: 'liver.glb', variants: variants('liver.glb', 'liver-v2.glb'), anatomy: true,
    description: 'The largest internal organ, integrating metabolism, detoxification, bile production, and storage.',
    facts: ['Hepatocytes are arranged around sinusoidal blood channels.', 'The portal vein supplies nutrient-rich blood from the gut.', 'Bile supports lipid digestion and waste excretion.'],
    metadata: { region: 'Right upper abdomen', scale: '~1.5 kg adult', focus: 'Lobes and portal structures' },
    hotspots: [spot('right-lobe', 'Right lobe', 'Largest anatomical lobe of the liver.', [-0.42, 0.15, 0.5]), spot('porta-hepatis', 'Porta hepatis', 'Gateway for portal vein, hepatic artery, and bile ducts.', [0.25, -0.35, 0.35])],
  },
  {
    id: 'nervous-system', name: 'Nervous System', scientificName: 'Systema nervosum', system: 'Nervous', file: 'nervous-system.glb', variants: variants('nervous-system.glb', 'nervous-system-v2.glb', 'nervous-system-v3.glb'), anatomy: true,
    description: 'A body-wide signaling network formed by central and peripheral neural structures.',
    facts: ['Afferent pathways carry sensory information toward the CNS.', 'Efferent pathways carry motor commands to effectors.', 'Myelin increases conduction velocity by saltatory conduction.'],
    metadata: { region: 'Whole body', scale: 'System overview', focus: 'CNS and major nerves' },
    hotspots: [spot('spinal-cord', 'Spinal cord', 'CNS pathway and site of segmental reflex circuits.', [0, 0.25, 0.1]), spot('sciatic-nerve', 'Sciatic nerve', 'Large peripheral nerve serving the posterior thigh and much of the leg.', [-0.28, -1.0, 0.08])],
  },
  {
    id: 'skin', name: 'Skin', scientificName: 'Cutis', system: 'Integumentary', file: 'skin.glb', variants: variants('skin.glb', 'skin-v2.glb'), anatomy: true,
    description: 'A layered barrier supporting protection, sensation, thermoregulation, and immune surveillance.',
    facts: ['The epidermis is avascular and nourished by diffusion.', 'The dermis contains vessels, nerves, and connective tissue.', 'Sweat evaporation supports thermoregulation.'],
    metadata: { region: 'Body surface', scale: '~1.5-2 m² adult', focus: 'Tissue layers' },
    hotspots: [spot('epidermis', 'Epidermis', 'Keratinized epithelial barrier at the surface.', [0, 0.85, 0.42]), spot('dermis', 'Dermis', 'Connective-tissue layer supporting the epidermis.', [0, 0.05, 0.42]), spot('hypodermis', 'Hypodermis', 'Subcutaneous tissue anchoring skin to deeper structures.', [0, -0.82, 0.42])],
  },
  {
    id: 'anatomy', name: 'Human Anatomy', scientificName: 'Corpus humanum', system: 'Whole Body', file: 'anatomy.glb', variants: variants('anatomy.glb'), anatomy: true,
    description: 'A whole-body orientation model for regional relationships and anatomical position.',
    facts: ['Anatomical position standardizes directional terminology.', 'Organ systems are structurally distinct but physiologically interdependent.', 'Regional anatomy emphasizes spatial relationships.'],
    metadata: { region: 'Whole body', scale: 'Adult overview', focus: 'Regional relationships' },
    hotspots: [spot('thorax', 'Thorax', 'Region housing the heart, lungs, and mediastinal structures.', [0, 0.45, 0.35]), spot('abdomen', 'Abdomen', 'Region containing most digestive organs and paired kidneys.', [0, -0.25, 0.35])],
  },
  {
    id: 'digestive-system', name: 'Digestive System', scientificName: 'Systema digestorium', system: 'Digestive', file: 'digestive-system.glb', variants: variants('digestive-system.glb'), anatomy: true,
    description: 'An integrated tract-and-organ overview of ingestion, digestion, absorption, and elimination.',
    facts: ['The gastrointestinal wall coordinates motility through smooth muscle and the enteric nervous system.', 'The hepatic portal circulation delivers absorbed nutrients to the liver before systemic distribution.', 'Pancreatic enzymes and bile enter the duodenum, while most nutrient absorption occurs farther along the small intestine.'],
    metadata: { region: 'Thorax to pelvis', scale: 'System overview', focus: 'Organ relationships and flow' },
    hotspots: [spot('esophagus', 'Esophagus', 'Muscular conduit moving a swallowed bolus to the stomach by peristalsis.', [0, 0.9, 0.25]), spot('stomach', 'Stomach', 'Reservoir that mixes food with acid and proteases to form chyme.', [-0.34, 0.18, 0.4]), spot('small-intestine', 'Small intestine', 'Primary site of enzymatic digestion and nutrient absorption.', [0.12, -0.62, 0.45])],
  },
  {
    id: 'arduino', name: 'Arduino Preview', scientificName: 'Embedded systems board', system: 'Engineering', file: 'arduino.glb', variants: variants('arduino.glb', 'arduino-v2.glb'), anatomy: false,
    description: 'A preview of Stranerd’s component-learning approach beyond anatomy.',
    facts: ['Microcontrollers combine processing, memory, and configurable I/O.', 'Digital pins represent discrete logic states.', 'The board’s regulator and USB interface support prototyping workflows.'],
    metadata: { region: 'Engineering preview', scale: 'Board level', focus: 'Embedded systems' },
    hotspots: [spot('microcontroller', 'Microcontroller', 'Executes the uploaded program and controls I/O.', [0, 0.05, 0.45]), spot('digital-io', 'Digital I/O', 'Header pins configurable as digital inputs or outputs.', [0, 0.72, 0.35]), spot('power-input', 'Power input', 'Accepts external supply power that is conditioned for the board rails.', [-0.75, -0.5, 0.35])],
  },
  {
    id: 'electronics-project', name: 'Electronics Project', scientificName: 'Prototyping circuit board', system: 'Engineering', file: 'electronics-project.glb', variants: variants('electronics-project.glb'), anatomy: false,
    description: 'A board-level component-identification preview using authored coordinate overlays on a single-mesh model.',
    facts: ['Board inspection begins by identifying power, control, and interface regions before tracing signals.', 'Capacitors near supply pins reduce transient rail noise.', 'Connectors provide the electrical and mechanical boundary between a board and external devices.'],
    metadata: { region: 'Engineering preview', scale: 'Board level', focus: 'Component identification' },
    hotspots: [spot('controller-ic', 'Controller IC', 'Integrated circuit coordinating the board’s programmed behavior.', [0.05, 0.12, 0.48]), spot('capacitor-bank', 'Capacitor bank', 'Local energy storage and supply-noise filtering components.', [-0.52, -0.28, 0.4]), spot('interface-header', 'Interface header', 'Connection points for power or signals to external hardware.', [0.62, 0.46, 0.34])],
  },
]

export const anatomyModels = models.filter((model) => model.anatomy)
export const engineeringModels = models.filter((model) => !model.anatomy)
export const modelById = (id: string) => models.find((model) => model.id === id) ?? models[0]
export const systems = [...new Set(anatomyModels.map((model) => model.system))]

import type { Hotspot, ModelEntry } from '../types.js'

const spot = (id: string, label: string, detail: string, position: [number, number, number]): Hotspot => ({ id, label, detail, position })
const variants = (...files: string[]) => files.map((file, index) => ({
  id: `v${index + 1}`,
  label: index === 0 ? 'Primary specimen' : `Specimen ${index + 1}`,
  file,
  note: index === 0 ? 'Default optimized study model.' : 'Alternate authored geometry of the same study subject.',
}))

const primaryHotspots: Record<string, Hotspot[]> = {
  heart: [
    spot('aorta', 'Ascending aorta', 'Main arterial outflow from the left ventricle.', [0.18, 1.2, 0.2]),
    spot('left-ventricle', 'Left ventricle', 'Forms much of the apex and pumps into systemic circulation.', [0.42, -0.45, 0.58]),
    spot('right-ventricle', 'Right ventricle', 'Anterior chamber that pumps toward the lungs.', [-0.28, -0.28, 0.62]),
    spot('pulmonary-artery', 'Pulmonary trunk', 'Carries blood from the right ventricle toward the lungs.', [0.08, 0.82, 0.42]),
    spot('superior-vena-cava', 'Superior vena cava', 'Returns blood from the upper body to the right atrium.', [-0.48, 1.0, 0.18]),
    spot('left-atrium', 'Left atrial appendage', 'Visible projection associated with the left atrium.', [0.58, 0.42, 0.5]),
    spot('coronary-vessels', 'Coronary vessels', 'Surface vessels supplying and draining the myocardium.', [0.08, -0.05, 0.72]),
  ],
  brain: [
    spot('frontal-lobe', 'Frontal lobe', 'Anterior cerebral region associated with executive and motor functions.', [-0.72, 0.3, 0.45]),
    spot('cerebellum', 'Cerebellum', 'Posteroinferior structure coordinating movement and motor learning.', [0.62, -0.68, 0.2]),
    spot('temporal-lobe', 'Temporal lobe', 'Inferolateral cerebral region involved in auditory processing and memory.', [-0.05, -0.28, 0.62]),
  ],
  lungs: [
    spot('right-upper-lobe', 'Right upper lobe', 'Superior lobe of the right lung.', [-0.52, 0.58, 0.42]),
    spot('left-lower-lobe', 'Left lower lobe', 'Inferior lobe of the left lung.', [0.55, -0.42, 0.42]),
    spot('trachea', 'Trachea', 'Cartilage-supported airway superior to the main bronchi.', [0, 1.08, 0.35]),
    spot('main-bronchi', 'Main bronchi', 'Primary airway branches entering the lungs.', [0, 0.42, 0.58]),
  ],
  kidney: [
    spot('right-kidney', 'Right kidney', 'Retroperitoneal organ filtering blood and regulating fluid balance.', [-0.68, 0.18, 0.45]),
    spot('left-kidney', 'Left kidney', 'Paired urinary organ positioned slightly higher than the right.', [0.68, 0.22, 0.45]),
    spot('renal-vessels', 'Renal vessels', 'Arteries and veins connecting each kidney to major abdominal vessels.', [0.3, 0.16, 0.58]),
    spot('ureter', 'Ureter', 'Muscular tube conducting urine from a kidney toward the bladder.', [0.58, -0.65, 0.32]),
  ],
  eye: [
    spot('eyeball', 'Eyeball', 'Globe containing the optical and sensory structures of vision.', [-0.38, 0, 0.45]),
    spot('optic-nerve', 'Optic nerve', 'Neural pathway carrying retinal output toward the brain.', [0.62, 0, 0.34]),
    spot('extraocular-muscles', 'Extraocular muscles', 'Muscles that rotate and stabilize the eyeball.', [0.15, 0.28, 0.55]),
  ],
  liver: [
    spot('right-lobe', 'Right lobe', 'Largest anatomical lobe of the liver.', [-0.38, 0.18, 0.5]),
    spot('porta-hepatis', 'Porta hepatis', 'Inferior gateway for vessels, nerves, and bile ducts.', [0.2, -0.38, 0.46]),
    spot('gallbladder', 'Gallbladder', 'Bile-storage organ on the visceral surface of the liver.', [-0.2, -0.48, 0.44]),
  ],
  skin: [
    spot('epidermis', 'Epidermis', 'Thin keratinized surface barrier.', [0, 0.85, 0.5]),
    spot('dermis', 'Dermis', 'Vascular connective-tissue layer beneath the epidermis.', [0, 0.08, 0.5]),
    spot('hypodermis', 'Hypodermis', 'Subcutaneous fatty layer anchoring skin to deeper structures.', [0, -0.72, 0.48]),
    spot('hair-follicle', 'Hair follicle', 'Epithelial structure producing and anchoring a hair shaft.', [-0.25, 0.02, 0.58]),
  ],
  'digestive-system': [
    spot('esophagus', 'Esophagus', 'Muscular conduit entering the stomach from above.', [0.15, 1.12, 0.36]),
    spot('stomach', 'Stomach', 'Muscular reservoir mixing food with gastric secretions.', [0.42, 0.52, 0.5]),
    spot('liver', 'Liver', 'Large metabolic organ superior to the stomach.', [-0.38, 0.72, 0.46]),
    spot('small-intestine', 'Small intestine', 'Coiled central bowel where most digestion and absorption occur.', [0, -0.35, 0.58]),
    spot('colon', 'Colon', 'Large bowel framing the small intestine and reclaiming water.', [0.38, -0.18, 0.52]),
  ],
}

const specimenVariants = (id: string, segmentedSystem: NonNullable<ModelEntry['variants'][number]['segmentedSystem']>, note: string, hasRealistic: boolean, ...files: string[]): ModelEntry['variants'] => [
  ...(hasRealistic ? [{ id: 'primary', label: 'Primary specimen', file: `${id}-realistic.glb`, note: 'Realistic textured study specimen.', hotspots: primaryHotspots[id] }] : []),
  { id: 'interactive', label: 'Interactive specimen', file: `${id}-segmented.glb`, note, segmentedSystem },
  ...variants(...files).map((variant, index) => ({ ...variant, id: `other-${index + 1}`, label: `Other specimen ${index + 1}` })),
]

const eyeVariants: ModelEntry['variants'] = [
  { id: 'primary', label: 'Primary specimen', file: 'eye-realistic.glb', note: 'Realistic textured study specimen.', hotspots: primaryHotspots.eye },
  { id: 'interactive', label: 'Interactive specimen', file: 'eye-segmented.glb', note: 'Interactive ocular layers with transparent optical media and exact structure selection.', segmentedSystem: 'nervous' },
  ...variants('eye.glb', 'eye-v2.glb').map((variant, index) => ({ ...variant, id: `other-${index + 1}`, label: `Other specimen ${index + 1}` })),
]

/**
 * Canonical camera table — one row per subject, authored against the 3.15-unit normalization
 * at fov 42. Distance fits the full specimen inside the usable canvas with the breakpoint's
 * safe padding; the per-subject clamp replaces the former global 2.2-8, which could not frame
 * both the eye and the whole-body atlas well. Reset restores its row exactly.
 */
const canonicalCameras: Record<string, ModelEntry['camera']> = {
  heart: { azimuth: 8, elevation: 6, distance: 4.5, minDistance: 1.6, maxDistance: 7, view: 'Anterior, great vessels up' },
  brain: { azimuth: -75, elevation: 8, distance: 4.6, minDistance: 1.8, maxDistance: 7, view: 'Left lateral, cerebellum visible' },
  lungs: { azimuth: 0, elevation: 4, distance: 4.8, minDistance: 1.8, maxDistance: 7.5, view: 'Anterior, trachea centred' },
  kidney: { azimuth: 0, elevation: 0, distance: 4.4, minDistance: 1.4, maxDistance: 6.5, view: 'Anterior pair, hila inward' },
  eye: { azimuth: -20, elevation: 6, distance: 4, minDistance: 0.9, maxDistance: 6, view: 'Three-quarter, optical axis readable' },
  liver: { azimuth: 12, elevation: 10, distance: 4.5, minDistance: 1.5, maxDistance: 7, view: 'Anteroinferior, porta hepatis in view' },
  'nervous-system': { azimuth: 0, elevation: 0, distance: 5.4, minDistance: 2, maxDistance: 8.5, view: 'Full height, CNS axis vertical' },
  skin: { azimuth: 0, elevation: 0, distance: 4.2, minDistance: 1.2, maxDistance: 6, view: 'Block face-on, layers stacked' },
  anatomy: { azimuth: 0, elevation: 0, distance: 6.3, minDistance: 2.6, maxDistance: 9.5, view: 'Anatomical position, fixed group transform' },
  'digestive-system': { azimuth: 0, elevation: 6, distance: 4.9, minDistance: 1.6, maxDistance: 7.5, view: 'Anterior, oesophagus to colon' },
}

const modelEntries: Omit<ModelEntry, 'camera'>[] = [
  {
    id: 'heart', name: 'Heart', scientificName: 'Cor', system: 'Cardiovascular', file: 'heart-realistic.glb', variants: specimenVariants('heart', 'cardiovascular', 'Named chambers, valves, vessels, and coronary structures.', true, 'heart.glb', 'heart-v2.glb', 'heart-v3.glb'), anatomy: true,
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
    id: 'brain', name: 'Brain', scientificName: 'Encephalon', system: 'Nervous', file: 'brain-realistic.glb', variants: specimenVariants('brain', 'nervous', 'Named cerebral regions, cerebellum, and brainstem structures.', true, 'brain.glb', 'brain-v2.glb', 'brain-v3.glb', 'brain-v4.glb', 'brain-v5.glb'), anatomy: true,
    description: 'The central integrative organ for sensation, movement, cognition, and homeostasis.',
    facts: ['The cerebral cortex is organized into functionally specialized networks.', 'The cerebellum refines movement and supports motor learning.', 'Cerebrospinal fluid provides buoyancy and chemical stability.'],
    metadata: { region: 'Cranial cavity', scale: '~1.3-1.4 kg adult', focus: 'Major divisions' },
    hotspots: [spot('frontal-lobe', 'Frontal lobe', 'Supports executive function and voluntary motor planning.', [-0.55, 0.25, 0.55]), spot('cerebellum', 'Cerebellum', 'Coordinates timing, precision, and motor adaptation.', [0.55, -0.62, -0.2]), spot('temporal-lobe', 'Temporal lobe', 'Participates in auditory processing and memory.', [-0.48, -0.28, 0.45])],
  },
  {
    id: 'lungs', name: 'Lungs', scientificName: 'Pulmones', system: 'Respiratory', file: 'lungs-realistic.glb', variants: specimenVariants('lungs', 'organs', 'Named lung lobes, bronchi, trachea, and respiratory structures.', true, 'lungs.glb', 'lungs-v2.glb', 'lungs-v3.glb'), anatomy: true,
    description: 'Paired organs that exchange respiratory gases across the alveolar-capillary barrier.',
    facts: ['The right lung usually has three lobes; the left has two.', 'Type II pneumocytes produce surfactant.', 'Ventilation and perfusion must be matched for efficient gas exchange.'],
    metadata: { region: 'Thorax', scale: '~4-6 L total capacity', focus: 'Lobes and airway' },
    hotspots: [spot('right-upper-lobe', 'Right upper lobe', 'One of three lobes of the right lung.', [-0.58, 0.62, 0.3]), spot('left-lower-lobe', 'Left lower lobe', 'Extends inferiorly near the diaphragm.', [0.55, -0.52, 0.22]), spot('trachea', 'Trachea', 'Conducting airway supported by cartilaginous rings.', [0, 1.12, 0.12])],
  },
  {
    id: 'kidney', name: 'Kidney', scientificName: 'Ren', system: 'Urinary', file: 'kidney-realistic.glb', variants: specimenVariants('kidney', 'organs', 'Named kidneys, renal pelves, ureters, bladder, and urethra.', true, 'kidney.glb', 'kidney-v2.glb'), anatomy: true,
    description: 'A retroperitoneal organ regulating fluid, electrolytes, acid-base balance, and waste excretion.',
    facts: ['Each kidney contains roughly one million nephrons.', 'The glomerulus begins plasma ultrafiltration.', 'Renin participates in blood-pressure regulation.'],
    metadata: { region: 'Posterior abdomen', scale: '~11 cm long', focus: 'Cortex, medulla, hilum' },
    hotspots: [spot('renal-cortex', 'Renal cortex', 'Outer region containing glomeruli and convoluted tubules.', [-0.62, 0.3, 0.35]), spot('renal-medulla', 'Renal medulla', 'Inner region organized into renal pyramids.', [0.05, -0.18, 0.42]), spot('renal-pelvis', 'Renal pelvis', 'Funnel collecting urine before the ureter.', [0.62, 0.02, 0.15])],
  },
  {
    id: 'eye', name: 'Eye', scientificName: 'Oculus', system: 'Sensory', file: 'eye-realistic.glb', variants: eyeVariants, anatomy: true,
    description: 'An optical and neural organ that focuses light onto the retina for visual transduction.',
    facts: ['The cornea provides most of the eye’s refractive power.', 'Photoreceptors convert light into graded electrical signals.', 'The optic disc lacks photoreceptors.'],
    metadata: { region: 'Orbit', scale: '~24 mm diameter', focus: 'Optical pathway' },
    hotspots: [spot('cornea', 'Cornea', 'Transparent anterior surface with major refractive power.', [0, 0, 0.95]), spot('lens', 'Lens', 'Changes shape to adjust optical focus.', [0, 0, 0.35]), spot('optic-nerve', 'Optic nerve', 'Carries retinal ganglion-cell axons toward the brain.', [0, 0, -0.96])],
  },
  {
    id: 'liver', name: 'Liver', scientificName: 'Hepar', system: 'Digestive', file: 'liver-realistic.glb', variants: specimenVariants('liver', 'organs', 'Named hepatic segments, gallbladder, bile ducts, and pancreas.', true, 'liver.glb', 'liver-v2.glb'), anatomy: true,
    description: 'The largest internal organ, integrating metabolism, detoxification, bile production, and storage.',
    facts: ['Hepatocytes are arranged around sinusoidal blood channels.', 'The portal vein supplies nutrient-rich blood from the gut.', 'Bile supports lipid digestion and waste excretion.'],
    metadata: { region: 'Right upper abdomen', scale: '~1.5 kg adult', focus: 'Lobes and portal structures' },
    hotspots: [spot('right-lobe', 'Right lobe', 'Largest anatomical lobe of the liver.', [-0.42, 0.15, 0.5]), spot('porta-hepatis', 'Porta hepatis', 'Gateway for portal vein, hepatic artery, and bile ducts.', [0.25, -0.35, 0.35])],
  },
  {
    id: 'nervous-system', name: 'Nervous System', scientificName: 'Systema nervosum', system: 'Nervous', file: 'nervous-system-segmented.glb', variants: specimenVariants('nervous-system', 'nervous', 'Named central and peripheral nervous structures.', false, 'nervous-system.glb', 'nervous-system-v2.glb', 'nervous-system-v3.glb'), anatomy: true,
    description: 'A body-wide signaling network formed by central and peripheral neural structures.',
    facts: ['Afferent pathways carry sensory information toward the CNS.', 'Efferent pathways carry motor commands to effectors.', 'Myelin increases conduction velocity by saltatory conduction.'],
    metadata: { region: 'Whole body', scale: 'System overview', focus: 'CNS and major nerves' },
    hotspots: [spot('spinal-cord', 'Spinal cord', 'CNS pathway and site of segmental reflex circuits.', [0, 0.25, 0.1]), spot('sciatic-nerve', 'Sciatic nerve', 'Large peripheral nerve serving the posterior thigh and much of the leg.', [-0.28, -1.0, 0.08])],
  },
  {
    id: 'skin', name: 'Skin', scientificName: 'Cutis', system: 'Integumentary', file: 'skin-realistic.glb', variants: specimenVariants('skin', 'skin', 'Named surface regions across the body.', true, 'skin.glb', 'skin-v2.glb'), anatomy: true,
    description: 'A layered barrier supporting protection, sensation, thermoregulation, and immune surveillance.',
    facts: ['The epidermis is avascular and nourished by diffusion.', 'The dermis contains vessels, nerves, and connective tissue.', 'Sweat evaporation supports thermoregulation.'],
    metadata: { region: 'Body surface', scale: '~1.5-2 m² adult', focus: 'Tissue layers' },
    hotspots: [spot('epidermis', 'Epidermis', 'Keratinized epithelial barrier at the surface.', [0, 0.85, 0.42]), spot('dermis', 'Dermis', 'Connective-tissue layer supporting the epidermis.', [0, 0.05, 0.42]), spot('hypodermis', 'Hypodermis', 'Subcutaneous tissue anchoring skin to deeper structures.', [0, -0.82, 0.42])],
  },
  {
    id: 'anatomy', name: 'Human Anatomy', scientificName: 'Corpus humanum', system: 'Whole Body', file: 'anatomy.glb', variants: variants('anatomy.glb'), anatomy: true, viewer: 'segmented-body',
    description: 'A progressively loaded whole-body atlas with aligned systems, selectable anatomy, and connected learning context.',
    facts: ['Anatomical position standardizes directional terminology.', 'Organ systems are structurally distinct but physiologically interdependent.', 'Regional anatomy emphasizes spatial relationships.'],
    metadata: { region: 'Whole body', scale: 'Layered atlas', focus: 'Systems and regional relationships' },
    hotspots: [spot('thorax', 'Thorax', 'Region housing the heart, lungs, and mediastinal structures.', [0, 0.45, 0.35]), spot('abdomen', 'Abdomen', 'Region containing most digestive organs and paired kidneys.', [0, -0.25, 0.35])],
  },
  {
    id: 'digestive-system', name: 'Digestive System', scientificName: 'Systema digestorium', system: 'Digestive', file: 'digestive-system-realistic.glb', variants: specimenVariants('digestive-system', 'organs', 'Named digestive organs, glands, ducts, and canal regions.', true, 'digestive-system.glb'), anatomy: true,
    description: 'An integrated tract-and-organ overview of ingestion, digestion, absorption, and elimination.',
    facts: ['The gastrointestinal wall coordinates motility through smooth muscle and the enteric nervous system.', 'The hepatic portal circulation delivers absorbed nutrients to the liver before systemic distribution.', 'Pancreatic enzymes and bile enter the duodenum, while most nutrient absorption occurs farther along the small intestine.'],
    metadata: { region: 'Thorax to pelvis', scale: 'System overview', focus: 'Organ relationships and flow' },
    hotspots: [spot('esophagus', 'Esophagus', 'Muscular conduit moving a swallowed bolus to the stomach by peristalsis.', [0, 0.9, 0.25]), spot('stomach', 'Stomach', 'Reservoir that mixes food with acid and proteases to form chyme.', [-0.34, 0.18, 0.4]), spot('small-intestine', 'Small intestine', 'Primary site of enzymatic digestion and nutrient absorption.', [0.12, -0.62, 0.45])],
  },
]

export const models: ModelEntry[] = modelEntries.map((entry) => ({ ...entry, camera: canonicalCameras[entry.id] }))

export const anatomyModels = models
export const modelById = (id: string) => models.find((model) => model.id === id) ?? models[0]
export const systems = [...new Set(anatomyModels.map((model) => model.system))]

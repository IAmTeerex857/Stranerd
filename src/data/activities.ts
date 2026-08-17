import type { DissectionActionType } from './dissection.js'

export type AnatomyActivityStep = {
  kind: 'action'
  action: DissectionActionType
  prompt: string
  success: string
  targetIds: string[]
} | {
  kind: 'question'
  prompt: string
  question: string
  options: [string, string, string, string]
  correctIndex: number
  explanation: string
  success: string
}

export type AnatomyActivity = {
  id: string
  modelId: string
  title: string
  description: string
  guided: boolean
  steps: AnatomyActivityStep[]
}

const select = (targetId: string, prompt: string, success: string): AnatomyActivityStep => ({ kind: 'action', action: 'select', targetIds: [targetId], prompt, success })
const act = (action: DissectionActionType, targetId: string, prompt: string, success: string): AnatomyActivityStep => ({ kind: 'action', action, targetIds: [targetId], prompt, success })
const question = (prompt: string, questionText: string, options: [string, string, string, string], correctIndex: number, explanation: string): AnatomyActivityStep => ({ kind: 'question', prompt, question: questionText, options, correctIndex, explanation, success: explanation })

export function activityActionMatches(step: AnatomyActivityStep, action: DissectionActionType, structureIds: string[], actionApplied = true) {
  if (step.kind !== 'action' || !actionApplied || step.action !== action) return false
  const expected = [...new Set(step.targetIds)].sort()
  const actual = [...new Set(structureIds)].sort()
  return expected.length === actual.length && expected.every((id, index) => id === actual[index])
}

export const anatomyActivities: AnatomyActivity[] = [
  { id: 'heart-flow', modelId: 'heart', title: 'Examine left ventricular pressure generation', description: 'Locate the left ventricle and relate its muscular wall to systemic circulation.', guided: true, steps: [
    select('anatomy:cardiovascular:left-ventricle', 'Select the left ventricle.', 'The left ventricle is identified.'),
    question('Relate the left ventricle to systemic flow.', 'What is the primary role of the left ventricle?', ['Pump blood through systemic circulation', 'Receive blood from the venae cavae', 'Pump blood only to the lungs', 'Initiate atrial contraction'], 0, 'The left ventricle generates pressure to drive blood through systemic circulation.'),
    act('isolate', 'anatomy:cardiovascular:left-ventricle', 'Isolate the left ventricle.', 'The left ventricle is isolated for inspection.'),
    question('Explain the left ventricle’s thicker wall.', 'Why is the left ventricular wall thicker than the right?', ['Systemic resistance is higher', 'Pulmonary blood is more viscous', 'The left ventricle fills first', 'The right ventricle has no myocardium'], 0, 'The systemic circuit has greater resistance, so the left ventricle generates higher pressure.'),
    act('move', 'anatomy:cardiovascular:left-ventricle', 'Drag the left ventricle outward.', 'The left ventricle is separated for spatial inspection.'),
  ] },
  { id: 'brain-regions', modelId: 'brain', title: 'Inspect the corpus callosum', description: 'Relate the corpus callosum’s position to communication between cerebral hemispheres.', guided: true, steps: [
    select('anatomy:nervous:corpus-callosum', 'Select the corpus callosum.', 'The corpus callosum is identified.'),
    question('Classify the corpus callosum.', 'What is the corpus callosum?', ['A commissural fibre tract', 'A cerebrospinal fluid gland', 'A cerebellar nucleus', 'A cranial nerve'], 0, 'The corpus callosum is the largest commissural tract connecting the cerebral hemispheres.'),
    act('transparent', 'anatomy:nervous:corpus-callosum', 'Fade the corpus callosum to reveal adjacent deep structures.', 'The faded corpus callosum remains positioned between the hemispheres.'),
    question('Relate commissural fibres to their function.', 'What does the corpus callosum primarily enable?', ['Communication between hemispheres', 'Cerebrospinal fluid drainage', 'Pituitary hormone release', 'Balance detection'], 0, 'Its axons exchange information between corresponding cortical regions.'),
    act('isolate', 'anatomy:nervous:corpus-callosum', 'Isolate the corpus callosum.', 'The corpus callosum is isolated.'),
  ] },
  { id: 'lung-airways', modelId: 'lungs', title: 'Trace the trachea into the left main bronchus', description: 'Follow the conducting airway from the cartilage-supported trachea into the left main bronchus.', guided: true, steps: [
    select('anatomy:organs:trachea', 'Select the trachea.', 'The trachea is identified.'),
    question('Explain how tracheal cartilage maintains airway patency.', 'Why does the trachea contain cartilage?', ['To resist airway collapse', 'To exchange oxygen directly', 'To produce surfactant', 'To pump air into alveoli'], 0, 'Cartilage supports airway patency while allowing posterior flexibility.'),
    act('transparent', 'anatomy:organs:trachea', 'Fade the trachea to reveal its bifurcation.', 'The faded trachea reveals the main bronchi while preserving airway continuity.'),
    question('Identify the branches immediately distal to the trachea.', 'The trachea divides directly into which structures?', ['Main bronchi', 'Alveolar ducts', 'Pulmonary veins', 'Pleural cavities'], 0, 'The trachea bifurcates into right and left main bronchi.'),
    act('isolate', 'anatomy:organs:left-main-bronchus', 'Select and isolate the left main bronchus.', 'The left main bronchus is isolated.'),
  ] },
  { id: 'urinary-pathway', modelId: 'kidney', title: 'Inspect the left kidney and urinary outflow', description: 'Relate the left kidney’s filtration role to urine transport through the ureter.', guided: true, steps: [
    select('anatomy:organs:kidney-left', 'Select the left kidney.', 'The left kidney is identified.'),
    question('State the kidney’s filtration and regulatory role.', 'Which is a primary kidney function?', ['Filter plasma and regulate fluid balance', 'Store bile', 'Produce digestive enzymes', 'Exchange respiratory gases'], 0, 'Kidneys filter plasma and regulate water, electrolytes, acid-base balance, and waste excretion.'),
    act('isolate', 'anatomy:organs:kidney-left', 'Isolate the left kidney.', 'The left kidney is isolated for inspection.'),
    question('Identify the tube carrying urine toward the bladder.', 'Which structure carries urine from a kidney toward the bladder?', ['Ureter', 'Urethra', 'Renal artery', 'Portal vein'], 0, 'Each ureter transports urine from a renal pelvis to the urinary bladder.'),
    act('move', 'anatomy:organs:kidney-left', 'Drag the left kidney outward.', 'The left kidney is separated for spatial inspection.'),
  ] },
  { id: 'eye-optics', modelId: 'eye', title: 'Inspect refraction at the left cornea', description: 'Relate the left cornea’s position and transparency to ocular refraction and retinal input.', guided: true, steps: [
    select('anatomy:nervous:cornea-left', 'Select the left cornea.', 'The left cornea is identified.'),
    question('Relate the air-cornea interface to refraction.', 'Which structure provides most of the eye’s refractive power?', ['Cornea', 'Lens', 'Retina', 'Optic nerve'], 0, 'The air-cornea interface provides most ocular refraction.'),
    act('transparent', 'anatomy:nervous:cornea-left', 'Fade the left cornea to reveal the anterior chamber and lens.', 'The faded left cornea reveals deeper optical structures.'),
    question('Identify the tissue that transduces focused light.', 'Which structure converts focused light into neural signals?', ['Retina', 'Sclera', 'Lacrimal gland', 'Cornea'], 0, 'Photoreceptors in the retina transduce light into neural signals.'),
    act('move', 'anatomy:nervous:cornea-left', 'Drag the left cornea outward.', 'The left cornea is separated from the anterior eye.'),
  ] },
  { id: 'liver-biliary', modelId: 'liver', title: 'Inspect gallbladder bile storage', description: 'Relate the gallbladder’s position beneath the liver to bile storage and delivery to the duodenum.', guided: true, steps: [
    select('anatomy:organs:gallbladder', 'Select the gallbladder.', 'The gallbladder is identified.'),
    question('State the gallbladder’s role in bile handling.', 'What is the primary function of the gallbladder?', ['Store and concentrate bile', 'Produce insulin', 'Filter portal blood', 'Digest proteins'], 0, 'The gallbladder stores and concentrates bile produced by the liver.'),
    act('isolate', 'anatomy:organs:gallbladder', 'Isolate the gallbladder.', 'The gallbladder is isolated.'),
    question('Identify where bile enters the small intestine.', 'Bile ultimately enters which part of the small intestine?', ['Duodenum', 'Jejunum only', 'Ileum only', 'Appendix'], 0, 'The common bile duct delivers bile to the duodenum.'),
    act('move', 'anatomy:organs:gallbladder', 'Drag the gallbladder away from the liver.', 'The gallbladder’s relationship to the liver is exposed.'),
  ] },
  { id: 'pancreas-pathway', modelId: 'digestive-system', title: 'Expose the pancreatic pathway', description: 'Reveal the pancreas and relate its secretions to the duodenum.', guided: true, steps: [
    { kind: 'action', action: 'hide', targetIds: ['anatomy:organs:stomach'], prompt: 'Select and hide the stomach to expose the pancreas.', success: 'The hidden stomach reveals the pancreas posterior to it.' },
    question('Identify the exocrine products released by the pancreas.', 'What does the exocrine pancreas release?', ['Digestive enzymes and bicarbonate', 'Bile and red blood cells', 'Hydrochloric acid and mucus', 'Only insulin'], 0, 'The exocrine pancreas releases digestive enzymes and bicarbonate-rich fluid.'),
    { kind: 'action', action: 'isolate', targetIds: ['anatomy:organs:pancreas'], prompt: 'Select and isolate the pancreas.', success: 'The pancreas is isolated within the upper abdomen.' },
    question('Identify where the main pancreatic duct empties.', 'Where does the main pancreatic duct deliver its secretions?', ['Duodenum', 'Stomach', 'Transverse colon', 'Gallbladder'], 0, 'The main pancreatic duct drains into the duodenum.'),
    { kind: 'action', action: 'select', targetIds: ['anatomy:organs:duodenum'], prompt: 'Select the duodenum that receives pancreatic secretions.', success: 'The duodenum receiving pancreatic secretions is identified.' },
  ] },
  { id: 'neural-pathways', modelId: 'nervous-system', title: 'Inspect spinal cord white matter', description: 'Relate spinal cord white matter to ascending sensory and descending motor pathways.', guided: true, steps: [
    select('anatomy:nervous:white-matter-of-spinal-cord', 'Select the white matter of the spinal cord.', 'Spinal cord white matter is identified.'),
    question('Relate spinal cord pathways to reflex integration.', 'Which function belongs to the spinal cord?', ['Carry long tracts and coordinate reflexes', 'Produce thyroid hormone', 'Filter cerebrospinal fluid', 'Control only facial sensation'], 0, 'The spinal cord carries ascending and descending pathways and coordinates segmental reflexes.'),
    act('transparent', 'anatomy:nervous:white-matter-of-spinal-cord', 'Fade the white matter of the spinal cord.', 'The faded white matter reveals adjacent spinal structures.'),
    question('Determine the direction of afferent signalling.', 'Afferent pathways carry information in which direction?', ['Toward the central nervous system', 'From the CNS to muscles only', 'Only between cerebral hemispheres', 'From glands to skin'], 0, 'Afferent pathways carry sensory information toward the CNS.'),
    act('isolate', 'anatomy:nervous:white-matter-of-spinal-cord', 'Isolate the white matter of the spinal cord.', 'Spinal cord white matter is isolated.'),
  ] },
  { id: 'skin-regions', modelId: 'skin', title: 'Map the left anterior forearm surface', description: 'Use the left anterior forearm region to connect cutaneous surface anatomy with epidermal and dermal function.', guided: true, steps: [
    select('anatomy:skin:anterior-region-of-forearm-left', 'Select the anterior region of the left forearm.', 'The left anterior forearm region is identified.'),
    question('Identify the avascular keratinized surface layer.', 'Which skin layer is avascular and keratinized?', ['Epidermis', 'Dermis', 'Hypodermis', 'Deep fascia'], 0, 'The epidermis is an avascular keratinized epithelial barrier.'),
    act('transparent', 'anatomy:skin:anterior-region-of-forearm-left', 'Fade the anterior region of the left forearm.', 'The faded left forearm region remains visible beside adjacent surface regions.'),
    question('Identify the vascular connective-tissue layer.', 'Which layer contains most cutaneous blood vessels and connective tissue?', ['Dermis', 'Epidermis', 'Stratum corneum only', 'Hair shaft'], 0, 'The dermis provides vascular connective-tissue support beneath the epidermis.'),
    act('move', 'anatomy:skin:anterior-region-of-forearm-left', 'Drag the anterior region of the left forearm outward.', 'The left anterior forearm region is separated for inspection.'),
  ] },
  { id: 'whole-body-systems', modelId: 'anatomy', title: 'Inspect the left femur in whole-body context', description: 'Relate the left femur’s position between hip and knee to load transmission through the thigh.', guided: true, steps: [
    select('anatomy:skeleton:femur-left', 'Select the left femur in the skeleton layer.', 'The left femur is identified.'),
    question('Relate the femur to lower-limb load transmission.', 'What is a primary function of the femur?', ['Transmit body weight through the thigh', 'Protect the brain', 'Filter blood plasma', 'Produce bile'], 0, 'The femur is the major load-bearing bone of the thigh and transmits forces between hip and knee.'),
    act('isolate', 'anatomy:skeleton:femur-left', 'Isolate the left femur.', 'The left femur is isolated in whole-body space.'),
    question('Identify the joints formed by the proximal and distal femur.', 'The femur participates directly in which two joints?', ['Hip and knee', 'Shoulder and elbow', 'Ankle and wrist', 'Jaw and neck'], 0, 'The femoral head forms the hip joint, while the distal femur forms part of the knee.'),
    act('move', 'anatomy:skeleton:femur-left', 'Drag the left femur outward from the skeleton.', 'The left femur is separated for inspection.'),
  ] },
]

export const activityForModel = (modelId: string) => anatomyActivities.find((activity) => activity.modelId === modelId)

import type { DissectionActionType } from './dissection'

export type AnatomyActivityStep = {
  kind: 'action'
  action: DissectionActionType
  prompt: string
  success: string
  targetIds?: string[]
  targetTerms?: string[]
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

const select = (prompt: string, term?: string): AnatomyActivityStep => ({ kind: 'action', action: 'select', prompt, success: 'Correct structure identified.', targetTerms: term ? [term] : undefined })
const act = (action: DissectionActionType, prompt: string, success: string): AnatomyActivityStep => ({ kind: 'action', action, prompt, success })
const question = (prompt: string, questionText: string, options: [string, string, string, string], correctIndex: number, explanation: string): AnatomyActivityStep => ({ kind: 'question', prompt, question: questionText, options, correctIndex, explanation, success: explanation })

export const anatomyActivities: AnatomyActivity[] = [
  { id: 'heart-flow', modelId: 'heart', title: 'Trace cardiac flow', description: 'Relate cardiac structures to pressure generation and blood flow.', guided: true, steps: [
    select('Select the left ventricle.', 'left ventricle'),
    question('Connect structure to function.', 'What is the primary role of the left ventricle?', ['Pump blood through systemic circulation', 'Receive blood from the venae cavae', 'Pump blood only to the lungs', 'Initiate atrial contraction'], 0, 'The left ventricle generates pressure to drive blood through systemic circulation.'),
    act('isolate', 'Isolate the selected left ventricle.', 'Isolation reveals its position and muscular form.'),
    question('Compare ventricular workloads.', 'Why is the left ventricular wall thicker than the right?', ['Systemic resistance is higher', 'Pulmonary blood is more viscous', 'The left ventricle fills first', 'The right ventricle has no myocardium'], 0, 'The systemic circuit has greater resistance, so the left ventricle generates higher pressure.'),
    act('move', 'Drag the left ventricle outward for a final spatial inspection.', 'The chamber has been manually separated.'),
  ] },
  { id: 'brain-regions', modelId: 'brain', title: 'Connect the cerebral hemispheres', description: 'Study the corpus callosum and interhemispheric communication.', guided: true, steps: [
    select('Select the corpus callosum.', 'corpus callosum'),
    question('Identify its neural role.', 'What is the corpus callosum?', ['A commissural fibre tract', 'A cerebrospinal fluid gland', 'A cerebellar nucleus', 'A cranial nerve'], 0, 'The corpus callosum is the largest commissural tract connecting the cerebral hemispheres.'),
    act('transparent', 'Fade the corpus callosum to inspect nearby deep structures.', 'Transparency preserves its position while revealing adjacent anatomy.'),
    question('Apply the relationship.', 'What does the corpus callosum primarily enable?', ['Communication between hemispheres', 'Cerebrospinal fluid drainage', 'Pituitary hormone release', 'Balance detection'], 0, 'Its axons exchange information between corresponding cortical regions.'),
    act('isolate', 'Isolate the corpus callosum.', 'The interhemispheric tract is isolated.'),
  ] },
  { id: 'lung-airways', modelId: 'lungs', title: 'Follow the conducting airway', description: 'Trace airflow from the trachea toward segmental bronchi.', guided: true, steps: [
    select('Select the trachea.', 'trachea'),
    question('Connect form to function.', 'Why does the trachea contain cartilage?', ['To resist airway collapse', 'To exchange oxygen directly', 'To produce surfactant', 'To pump air into alveoli'], 0, 'Cartilage supports airway patency while allowing posterior flexibility.'),
    act('transparent', 'Fade the trachea to compare its continuation into the bronchi.', 'The airway relationship remains visible in context.'),
    question('Trace the next branch.', 'The trachea divides directly into which structures?', ['Main bronchi', 'Alveolar ducts', 'Pulmonary veins', 'Pleural cavities'], 0, 'The trachea bifurcates into right and left main bronchi.'),
    act('isolate', 'Select an airway branch and isolate it.', 'A conducting airway branch is isolated.'),
  ] },
  { id: 'urinary-pathway', modelId: 'kidney', title: 'Trace the urinary pathway', description: 'Connect renal filtration to urine transport and storage.', guided: true, steps: [
    select('Select either kidney.', 'kidney'),
    question('Identify renal function.', 'Which is a primary kidney function?', ['Filter plasma and regulate fluid balance', 'Store bile', 'Produce digestive enzymes', 'Exchange respiratory gases'], 0, 'Kidneys filter plasma and regulate water, electrolytes, acid-base balance, and waste excretion.'),
    act('isolate', 'Isolate the selected kidney.', 'The kidney is isolated for inspection.'),
    question('Trace urine flow.', 'Which structure carries urine from a kidney toward the bladder?', ['Ureter', 'Urethra', 'Renal artery', 'Portal vein'], 0, 'Each ureter transports urine from a renal pelvis to the urinary bladder.'),
    act('move', 'Drag the isolated kidney outward.', 'The kidney has been manually separated.'),
  ] },
  { id: 'eye-optics', modelId: 'eye', title: 'Follow the optical pathway', description: 'Relate transparent optical structures to neural vision.', guided: true, steps: [
    select('Select either cornea.', 'cornea'),
    question('Identify its optical role.', 'Which structure provides most of the eye’s refractive power?', ['Cornea', 'Lens', 'Retina', 'Optic nerve'], 0, 'The air-cornea interface provides most ocular refraction.'),
    act('transparent', 'Fade the selected cornea to reveal structures behind it.', 'The lens and internal optical media are easier to inspect.'),
    question('Move from optics to sensation.', 'Which structure converts focused light into neural signals?', ['Retina', 'Sclera', 'Lacrimal gland', 'Cornea'], 0, 'Photoreceptors in the retina transduce light into neural signals.'),
    act('move', 'Drag the cornea outward to expose the anterior eye.', 'The cornea has been manually separated.'),
  ] },
  { id: 'liver-biliary', modelId: 'liver', title: 'Explore bile storage and flow', description: 'Relate the liver, gallbladder, and ducts to digestion.', guided: true, steps: [
    select('Select the gallbladder.', 'gallbladder'),
    question('Identify its role.', 'What is the primary function of the gallbladder?', ['Store and concentrate bile', 'Produce insulin', 'Filter portal blood', 'Digest proteins'], 0, 'The gallbladder stores and concentrates bile produced by the liver.'),
    act('isolate', 'Isolate the gallbladder.', 'The bile-storage organ is isolated.'),
    question('Trace bile toward the intestine.', 'Bile ultimately enters which part of the small intestine?', ['Duodenum', 'Jejunum only', 'Ileum only', 'Appendix'], 0, 'The common bile duct delivers bile to the duodenum.'),
    act('move', 'Drag the gallbladder away from the liver.', 'Its relationship to the liver is now exposed.'),
  ] },
  { id: 'pancreas-pathway', modelId: 'digestive-system', title: 'Expose the pancreatic pathway', description: 'Reveal the pancreas and relate its secretions to the duodenum.', guided: true, steps: [
    { kind: 'action', action: 'hide', targetIds: ['anatomy:organs:stomach'], prompt: 'Select and hide the stomach.', success: 'The pancreas posterior to the stomach is exposed.' },
    question('Connect the pancreas to digestion.', 'What does the exocrine pancreas release?', ['Digestive enzymes and bicarbonate', 'Bile and red blood cells', 'Hydrochloric acid and mucus', 'Only insulin'], 0, 'The exocrine pancreas releases digestive enzymes and bicarbonate-rich fluid.'),
    { kind: 'action', action: 'isolate', targetIds: ['anatomy:organs:pancreas'], prompt: 'Select and isolate the pancreas.', success: 'The pancreas is isolated within the upper abdomen.' },
    question('Trace the secretion pathway.', 'Where does the main pancreatic duct deliver its secretions?', ['Duodenum', 'Stomach', 'Transverse colon', 'Gallbladder'], 0, 'The main pancreatic duct drains into the duodenum.'),
    { kind: 'action', action: 'select', targetIds: ['anatomy:organs:duodenum'], prompt: 'Select the duodenum.', success: 'The receiving segment of small intestine is identified.' },
  ] },
  { id: 'neural-pathways', modelId: 'nervous-system', title: 'Study central neural pathways', description: 'Relate the spinal cord to sensory, motor, and reflex function.', guided: true, steps: [
    select('Select the spinal cord.', 'spinal cord'),
    question('Identify its integrative role.', 'Which function belongs to the spinal cord?', ['Carry long tracts and coordinate reflexes', 'Produce thyroid hormone', 'Filter cerebrospinal fluid', 'Control only facial sensation'], 0, 'The spinal cord carries ascending and descending pathways and coordinates segmental reflexes.'),
    act('transparent', 'Fade the spinal cord to inspect surrounding pathways.', 'Nearby neural structures remain visible.'),
    question('Interpret pathway direction.', 'Afferent pathways carry information in which direction?', ['Toward the central nervous system', 'From the CNS to muscles only', 'Only between cerebral hemispheres', 'From glands to skin'], 0, 'Afferent pathways carry sensory information toward the CNS.'),
    act('isolate', 'Isolate the spinal cord.', 'The central pathway is isolated.'),
  ] },
  { id: 'skin-regions', modelId: 'skin', title: 'Relate skin layers to function', description: 'Connect surface protection with deeper support and sensation.', guided: true, steps: [
    select('Select any segmented skin region.'),
    question('Identify the surface barrier.', 'Which skin layer is avascular and keratinized?', ['Epidermis', 'Dermis', 'Hypodermis', 'Deep fascia'], 0, 'The epidermis is an avascular keratinized epithelial barrier.'),
    act('transparent', 'Fade the selected region to inspect neighboring surfaces.', 'Adjacent regions remain visible in context.'),
    question('Identify deeper support.', 'Which layer contains most cutaneous blood vessels and connective tissue?', ['Dermis', 'Epidermis', 'Stratum corneum only', 'Hair shaft'], 0, 'The dermis provides vascular connective-tissue support beneath the epidermis.'),
    act('move', 'Drag the selected region outward.', 'The surface region has been manually separated.'),
  ] },
  { id: 'whole-body-systems', modelId: 'anatomy', title: 'Investigate the femur', description: 'Use whole-body context to study the major load-bearing bone of the thigh.', guided: true, steps: [
    select('Select either femur in the skeleton.', 'femur'),
    question('Connect the femur to function.', 'What is a primary function of the femur?', ['Transmit body weight through the thigh', 'Protect the brain', 'Filter blood plasma', 'Produce bile'], 0, 'The femur is the major load-bearing bone of the thigh and transmits forces between hip and knee.'),
    act('isolate', 'Isolate the selected femur.', 'The femur is isolated within whole-body space.'),
    question('Relate it to neighboring joints.', 'The femur participates directly in which two joints?', ['Hip and knee', 'Shoulder and elbow', 'Ankle and wrist', 'Jaw and neck'], 0, 'The femoral head forms the hip joint, while the distal femur forms part of the knee.'),
    act('move', 'Drag the femur outward from the skeleton.', 'The femur has been manually separated for inspection.'),
  ] },
]

export const activityForModel = (modelId: string) => anatomyActivities.find((activity) => activity.modelId === modelId)

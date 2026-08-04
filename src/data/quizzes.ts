import type { Evaluation, Quiz } from '../types'

export const quizzesByModel: Record<string, Quiz> = {
  heart: { id: 'heart-quiz', modelId: 'heart', question: 'When are the coronary arteries perfused most effectively?', options: ['During ventricular systole', 'During ventricular diastole', 'Only during atrial systole'], correctIndex: 1, explanation: 'During diastole, ventricular relaxation reduces compression of coronary vessels and aortic pressure drives myocardial perfusion.' },
  brain: { id: 'brain-quiz', modelId: 'brain', question: 'Which major division most directly refines movement timing and motor adaptation?', options: ['Frontal lobe', 'Temporal lobe', 'Cerebellum', 'Optic chiasm'], correctIndex: 2, explanation: 'The cerebellum compares intended and performed movement, supporting coordination and motor learning.' },
  lungs: { id: 'lungs-quiz', modelId: 'lungs', question: 'Which cells produce pulmonary surfactant?', options: ['Type I pneumocytes', 'Type II pneumocytes', 'Alveolar macrophages'], correctIndex: 1, explanation: 'Type II pneumocytes secrete surfactant, lowering alveolar surface tension and helping prevent collapse.' },
  kidney: { id: 'kidney-quiz', modelId: 'kidney', question: 'Where does plasma ultrafiltration begin?', options: ['Renal pelvis', 'Collecting duct', 'Glomerulus', 'Ureter'], correctIndex: 2, explanation: 'Glomerular capillaries filter plasma into Bowman’s space at the start of nephron processing.' },
  eye: { id: 'eye-quiz', modelId: 'eye', question: 'Which structure provides most of the eye’s refractive power?', options: ['Lens', 'Cornea', 'Retina', 'Optic nerve'], correctIndex: 1, explanation: 'The air-cornea interface produces most refraction; the lens fine-tunes focus by accommodation.' },
  intestine: { id: 'intestine-quiz', modelId: 'intestine', question: 'Where does most nutrient absorption occur?', options: ['Small intestine', 'Colon', 'Stomach'], correctIndex: 0, explanation: 'The small intestine provides extensive folds, villi, and microvilli for nutrient absorption.' },
  liver: { id: 'liver-quiz', modelId: 'liver', question: 'Which vessel supplies the liver with nutrient-rich blood from the gut?', options: ['Hepatic vein', 'Portal vein', 'Inferior vena cava'], correctIndex: 1, explanation: 'The portal vein carries absorbed nutrients from the gastrointestinal tract to hepatic sinusoids.' },
  'nervous-system': { id: 'nervous-system-quiz', modelId: 'nervous-system', question: 'In which direction do afferent pathways carry information?', options: ['From the CNS to effectors', 'Toward the CNS from sensory receptors', 'Only between muscles'], correctIndex: 1, explanation: 'Afferent pathways carry sensory information toward the central nervous system.' },
  skin: { id: 'skin-quiz', modelId: 'skin', question: 'Which skin layer is avascular?', options: ['Epidermis', 'Dermis', 'Hypodermis'], correctIndex: 0, explanation: 'The epidermis contains no blood vessels and receives nutrients by diffusion from the dermis.' },
  anatomy: { id: 'anatomy-quiz', modelId: 'anatomy', question: 'Why is anatomical position used?', options: ['To estimate organ mass', 'To standardize directional terminology', 'To measure cardiac output'], correctIndex: 1, explanation: 'Anatomical position gives clinicians and students a shared reference for directional and regional terms.' },
  'digestive-system': { id: 'digestive-system-quiz', modelId: 'digestive-system', question: 'Where does portal blood carrying absorbed nutrients travel before systemic distribution?', options: ['Directly to the lungs', 'First to the liver', 'First to the kidneys', 'Directly to the left ventricle'], correctIndex: 1, explanation: 'The hepatic portal circulation routes nutrient-rich gastrointestinal blood through the liver first.' },
  arduino: { id: 'arduino-quiz', modelId: 'arduino', question: 'Which board component executes uploaded firmware?', options: ['Power connector', 'Microcontroller', 'Digital header'], correctIndex: 1, explanation: 'The microcontroller fetches and executes program instructions while controlling configured I/O.' },
  'electronics-project': { id: 'electronics-project-quiz', modelId: 'electronics-project', question: 'Why are capacitors commonly placed near an integrated circuit’s supply pins?', options: ['To increase connector strength', 'To reduce transient supply noise', 'To program the controller'], correctIndex: 1, explanation: 'Local decoupling capacitors provide transient current and reduce voltage disturbances on supply rails.' },
}

export const quizzes = Object.values(quizzesByModel)
export const quizForModel = (modelId: string) => quizzesByModel[modelId]

export function evaluateQuiz(quiz: Quiz, selectedIndex: number | undefined): Evaluation {
  const pass = selectedIndex === quiz.correctIndex
  return {
    pass,
    detail: selectedIndex === undefined
      ? 'selected = none'
      : `selected = option ${selectedIndex + 1}; expected option ${quiz.correctIndex + 1}`,
  }
}

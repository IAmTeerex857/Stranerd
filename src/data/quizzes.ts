import type { Evaluation, Quiz } from '../types.js'
import { models } from './models.js'

export const quizzesByModel: Record<string, Quiz> = {
  heart: { id: 'heart-quiz', modelId: 'heart', question: 'When are the coronary arteries perfused most effectively?', options: ['During ventricular systole', 'During ventricular diastole', 'Only during atrial systole'], correctIndex: 1, explanation: 'During diastole, ventricular relaxation reduces compression of coronary vessels and aortic pressure drives myocardial perfusion.' },
  brain: { id: 'brain-quiz', modelId: 'brain', question: 'Which major division most directly refines movement timing and motor adaptation?', options: ['Frontal lobe', 'Temporal lobe', 'Cerebellum', 'Optic chiasm'], correctIndex: 2, explanation: 'The cerebellum compares intended and performed movement, supporting coordination and motor learning.' },
  lungs: { id: 'lungs-quiz', modelId: 'lungs', question: 'Which cells produce pulmonary surfactant?', options: ['Type I pneumocytes', 'Type II pneumocytes', 'Alveolar macrophages'], correctIndex: 1, explanation: 'Type II pneumocytes secrete surfactant, lowering alveolar surface tension and helping prevent collapse.' },
  kidney: { id: 'kidney-quiz', modelId: 'kidney', question: 'Where does plasma ultrafiltration begin?', options: ['Renal pelvis', 'Collecting duct', 'Glomerulus', 'Ureter'], correctIndex: 2, explanation: 'Glomerular capillaries filter plasma into Bowman’s space at the start of nephron processing.' },
  eye: { id: 'eye-quiz', modelId: 'eye', question: 'Which structure provides most of the eye’s refractive power?', options: ['Lens', 'Cornea', 'Retina', 'Optic nerve'], correctIndex: 1, explanation: 'The air-cornea interface produces most refraction; the lens fine-tunes focus by accommodation.' },
  liver: { id: 'liver-quiz', modelId: 'liver', question: 'Which vessel supplies the liver with nutrient-rich blood from the gut?', options: ['Hepatic vein', 'Portal vein', 'Inferior vena cava'], correctIndex: 1, explanation: 'The portal vein carries absorbed nutrients from the gastrointestinal tract to hepatic sinusoids.' },
  'nervous-system': { id: 'nervous-system-quiz', modelId: 'nervous-system', question: 'In which direction do afferent pathways carry information?', options: ['From the CNS to effectors', 'Toward the CNS from sensory receptors', 'Only between muscles'], correctIndex: 1, explanation: 'Afferent pathways carry sensory information toward the central nervous system.' },
  skin: { id: 'skin-quiz', modelId: 'skin', question: 'Which skin layer is avascular?', options: ['Epidermis', 'Dermis', 'Hypodermis'], correctIndex: 0, explanation: 'The epidermis contains no blood vessels and receives nutrients by diffusion from the dermis.' },
  anatomy: { id: 'anatomy-quiz', modelId: 'anatomy', question: 'Why is anatomical position used?', options: ['To estimate organ mass', 'To standardize directional terminology', 'To measure cardiac output'], correctIndex: 1, explanation: 'Anatomical position gives clinicians and students a shared reference for directional and regional terms.' },
  'digestive-system': { id: 'digestive-system-quiz', modelId: 'digestive-system', question: 'Where does portal blood carrying absorbed nutrients travel before systemic distribution?', options: ['Directly to the lungs', 'First to the liver', 'First to the kidneys', 'Directly to the left ventricle'], correctIndex: 1, explanation: 'The hepatic portal circulation routes nutrient-rich gastrointestinal blood through the liver first.' },
}

export const quizzes = Object.values(quizzesByModel)
export const quizForModel = (modelId: string) => quizzesByModel[modelId]

function seededOrder<T>(values: T[], seed: number) {
  const result = [...values]
  let value = seed || 1
  for (let index = result.length - 1; index > 0; index--) {
    value = (value * 1664525 + 1013904223) >>> 0
    const next = value % (index + 1)
    ;[result[index], result[next]] = [result[next], result[index]]
  }
  return result
}

const globalDistractors = [...new Set(models.flatMap((model) => [model.name, ...model.hotspots.map((hotspot) => hotspot.label)]))]

function fourOptions(answer: string, preferred: string[], seed: number) {
  const distractors = seededOrder([...new Set([...preferred, ...globalDistractors])].filter((option) => option !== answer), seed).slice(0, 3)
  const options = seededOrder([answer, ...distractors], seed ^ 0x9e3779b9)
  return { options, correctIndex: options.indexOf(answer) }
}

export function quizzesForModel(modelId: string, seed = 0): Quiz[] {
  const quiz = quizForModel(modelId)
  if (!quiz) return []
  const model = models.find((entry) => entry.id === modelId)
  const authoredAnswer = quiz.options[quiz.correctIndex]
  const authored = fourOptions(authoredAnswer, quiz.options, seed + 1)
  if (!model) return [{ ...quiz, ...authored, kind: 'multiple-choice' }]
  const structures = model.hotspots.length > 0 ? model.hotspots : [{ id: model.id, label: model.name, detail: model.description, position: [0, 0, 0] as [number, number, number] }]
  const generated = Array.from({ length: 19 }, (_, index): Quiz => {
    const structure = seededOrder(structures, seed + index * 97)[index % structures.length]
    const choices = fourOptions(structure.label, structures.map((entry) => entry.label), seed + index * 131)
    const prompts = [
      `Which structure best matches this description: ${structure.detail}`,
      `Identify the structure associated with this feature: ${structure.detail}`,
      `Which option represents the following anatomical role: ${structure.detail}`,
      `Select the structure described here: ${structure.detail}`,
    ]
    return {
      id: `${modelId}-structure-${index + 1}`,
      modelId,
      kind: 'multiple-choice',
      question: prompts[(seed + index) % prompts.length],
      ...choices,
      explanation: `${structure.label}: ${structure.detail}`,
    }
  })
  return [{ ...quiz, ...authored, kind: 'multiple-choice' }, ...generated]
}

export const allQuizzes = Object.keys(quizzesByModel).flatMap(quizzesForModel)

export function defaultQuizIdsForModel(modelId: string) {
  return quizzesForModel(modelId).map((quiz) => quiz.id)
}

export function assessmentProgressForModel(modelId: string, completedQuizIds: string[]) {
  const ids = new Set(defaultQuizIdsForModel(modelId))
  const completed = new Set(completedQuizIds.filter((id) => ids.has(id))).size
  return {
    completed,
    total: ids.size,
    status: completed === 0 ? 'not-started' as const : completed === ids.size ? 'complete' as const : 'in-progress' as const,
  }
}

export function evaluateQuiz(quiz: Quiz, selectedIndex: number | undefined): Evaluation {
  const pass = selectedIndex === quiz.correctIndex
  return {
    pass,
    detail: selectedIndex === undefined
      ? 'selected = none'
      : `selected = option ${selectedIndex + 1}; expected option ${quiz.correctIndex + 1}`,
  }
}

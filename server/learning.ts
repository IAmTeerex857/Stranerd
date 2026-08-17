import { requireAiUser } from './aiCredits.js'
import { anatomyActivities } from '../src/data/activities.js'
import { quizzesForModel } from '../src/data/quizzes.js'
import { flashcardDeckById } from '../src/data/flashcards.js'

const ACTIVITY_ID = /^[a-z0-9-]{1,80}$/
const digestiveDissectionQuiz = {
  question: 'After exposing the pancreas, which structure receives its digestive secretions?',
  options: ['Stomach', 'Duodenum', 'Transverse colon', 'Gallbladder'] as [string, string, string, string],
  correctIndex: 1,
  explanation: 'The pancreatic duct empties into the duodenum, where pancreatic enzymes and bicarbonate join chyme from the stomach.',
}

export class LearningError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

export function learningErrorResponse(error: unknown) {
  if (error instanceof LearningError) return { status: error.status, body: { error: error.code, message: error.message } }
  if (error && typeof error === 'object' && 'status' in error && Number(error.status) === 401) return { status: 401, body: { error: 'authentication_required', message: 'Sign in to access this learning activity.' } }
  console.error('Learning activity request failed:', error instanceof Error ? error.message : error)
  return { status: 500, body: { error: 'internal_error', message: 'The learning activity could not be loaded.' } }
}

function activity(activityId: unknown) {
  if (typeof activityId !== 'string' || !ACTIVITY_ID.test(activityId)) throw new LearningError(400, 'invalid_activity', 'A valid Lab activity is required.')
  const result = anatomyActivities.find((entry) => entry.id === activityId)
  if (!result) throw new LearningError(404, 'activity_not_found', 'This Lab activity is unavailable.')
  return result
}

export async function getProtectedLabActivity(authorization: string | undefined, activityId: unknown) {
  await requireAiUser(authorization)
  const source = activity(activityId)
  return {
    activity: {
      ...source,
      steps: source.steps.map((step) => step.kind === 'question'
        ? { kind: step.kind, prompt: step.prompt, question: step.question, options: step.options, success: step.success }
        : step),
      finalQuestion: source.modelId === 'digestive-system' ? { question: digestiveDissectionQuiz.question, options: digestiveDissectionQuiz.options } : undefined,
    },
  }
}

export async function gradeProtectedLabQuestion(authorization: string | undefined, body: Record<string, unknown> | undefined) {
  await requireAiUser(authorization)
  const source = activity(body?.activityId)
  const choice = body?.choice
  if (!Number.isInteger(choice) || Number(choice) < 0 || Number(choice) > 3) throw new LearningError(400, 'invalid_choice', 'Choose a valid answer.')
  if (body?.stepIndex === 'final') {
    if (source.modelId !== 'digestive-system') throw new LearningError(400, 'invalid_step', 'This activity has no final question.')
    return { correct: choice === digestiveDissectionQuiz.correctIndex, explanation: digestiveDissectionQuiz.explanation }
  }
  const stepIndex = body?.stepIndex
  if (!Number.isInteger(stepIndex) || Number(stepIndex) < 0 || Number(stepIndex) >= source.steps.length) throw new LearningError(400, 'invalid_step', 'Choose a valid Lab question.')
  const step = source.steps[Number(stepIndex)]
  if (step.kind !== 'question') throw new LearningError(400, 'invalid_step', 'The current Lab step is not a question.')
  return { correct: choice === step.correctIndex, explanation: step.explanation }
}

function assessmentInput(body: Record<string, unknown> | undefined) {
  const modelId = body?.modelId
  const seed = body?.seed
  if (typeof modelId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(modelId) || !Number.isInteger(seed) || Number(seed) < 1 || Number(seed) > 0xffffffff) {
    throw new LearningError(400, 'invalid_assessment', 'A valid assessment is required.')
  }
  const quizzes = quizzesForModel(modelId, Number(seed))
  if (quizzes.length !== 20) throw new LearningError(404, 'assessment_not_found', 'This assessment is unavailable.')
  return { modelId, seed: Number(seed), quizzes }
}

export async function getProtectedAssessment(authorization: string | undefined, body: Record<string, unknown> | undefined) {
  await requireAiUser(authorization)
  const { quizzes } = assessmentInput(body)
  return { quizzes: quizzes.map((quiz) => ({ id: quiz.id, modelId: quiz.modelId, kind: quiz.kind, question: quiz.question, options: quiz.options, correctIndex: -1, explanation: '' })) }
}

export async function gradeProtectedAssessment(authorization: string | undefined, body: Record<string, unknown> | undefined) {
  await requireAiUser(authorization)
  const { quizzes } = assessmentInput(body)
  if (!body?.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) throw new LearningError(400, 'invalid_answers', 'Answer every question before submitting.')
  const answers = body.answers as Record<string, unknown>
  if (Object.keys(answers).length !== quizzes.length || quizzes.some((_, index) => !Number.isInteger(answers[index]) || Number(answers[index]) < 0 || Number(answers[index]) > 3)) {
    throw new LearningError(400, 'invalid_answers', 'Answer every question before submitting.')
  }
  return { quizzes, score: quizzes.filter((quiz, index) => answers[index] === quiz.correctIndex).length }
}

export async function getProtectedBuiltInDeck(authorization: string | undefined, deckId: unknown) {
  await requireAiUser(authorization)
  if (typeof deckId !== 'string' || !/^[a-z0-9-]{1,100}$/.test(deckId)) throw new LearningError(400, 'invalid_deck', 'A valid flashcard deck is required.')
  const deck = flashcardDeckById(deckId)
  if (!deck) throw new LearningError(404, 'deck_not_found', 'This flashcard deck is unavailable.')
  return { deck }
}

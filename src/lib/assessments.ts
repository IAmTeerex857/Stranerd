import type { Quiz } from '../types'
import { supabase } from './supabase'

async function assessmentRequest<T>(action: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Assessments are unavailable because Supabase is not configured.')
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Sign in to access this assessment.')
  const response = await fetch(`/api/learning?action=${encodeURIComponent(action)}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({})) as T & { message?: string }
  if (!response.ok) throw new Error(result.message || 'The assessment could not be loaded.')
  return result
}

export function getModelAssessment(modelId: string, seed: number) {
  return assessmentRequest<{ quizzes: Quiz[] }>('assessment', { modelId, seed })
}

export function gradeModelAssessment(modelId: string, seed: number, answers: Record<number, number>) {
  return assessmentRequest<{ quizzes: Quiz[]; score: number }>('assessment-grade', { modelId, seed, answers })
}

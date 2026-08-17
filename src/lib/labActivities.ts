import type { DissectionActionType } from '../data/dissection'
import type { FlashcardDeck } from '../types'
import { supabase } from './supabase'

export type LabActivityStep = {
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
  success: string
}

export type LabActivity = {
  id: string
  modelId: string
  title: string
  description: string
  guided: boolean
  steps: LabActivityStep[]
  finalQuestion?: { question: string; options: [string, string, string, string] }
}

async function learningRequest<T>(action: string, input: Record<string, unknown>, method = 'GET'): Promise<T> {
  if (!supabase) throw new Error('Learning activities are unavailable because Supabase is not configured.')
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) throw new Error('Sign in to access this learning activity.')
  const query = method === 'GET' ? `&${new URLSearchParams(Object.entries(input).map(([key, value]) => [key, String(value)])).toString()}` : ''
  const response = await fetch(`/api/learning?action=${encodeURIComponent(action)}${query}`, {
    method,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
    body: method === 'POST' ? JSON.stringify(input) : undefined,
  })
  const result = await response.json().catch(() => ({})) as T & { message?: string }
  if (!response.ok) throw new Error(result.message || 'The learning activity could not be loaded.')
  return result
}

export function getLabActivity(activityId: string) {
  return learningRequest<{ activity: LabActivity }>('lab', { activityId })
}

export function getBuiltInFlashcardDeck(deckId: string) {
  return learningRequest<{ deck: FlashcardDeck }>('deck', { deckId })
}

export function gradeLabQuestion(activityId: string, stepIndex: number | 'final', choice: number) {
  return learningRequest<{ correct: boolean; explanation: string }>('lab-grade', { activityId, stepIndex, choice }, 'POST')
}

export function activityActionMatches(step: LabActivityStep, action: DissectionActionType, structureIds: string[], actionApplied = true) {
  if (step.kind !== 'action' || !actionApplied || step.action !== action) return false
  const expected = [...new Set(step.targetIds)].sort()
  const actual = [...new Set(structureIds)].sort()
  return expected.length === actual.length && expected.every((id, index) => id === actual[index])
}

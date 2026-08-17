import type { CreditBalance } from './ai'
import { AIActionError } from './ai'
import { supabase } from './supabase'
import {
  LIBRARY_AUDIO_MIME_TYPES,
  LIBRARY_DOCUMENT_MIME_TYPES,
  LIBRARY_MAX_FILE_BYTES,
  type LibraryGenerationRequest,
  type LibraryItemContent,
  type LibraryOutputType,
  type LibrarySourceCategory,
} from '../../shared/library'
import type { LibraryStudyProgress } from '../../shared/libraryProgress'

export type LibrarySet = {
  id: string
  title: string
  outputType: LibraryOutputType
  sourceCategory: LibrarySourceCategory
  requestedCount: number
  itemCount: number
  generationCost: number
  version: number
  status: 'generating' | 'ready' | 'failed'
  createdAt: string
  updatedAt: string
}

export type LibraryItem = { id: string; ordinal: number; content: LibraryItemContent }
export type LibraryJob = {
  id: string; setId: string; targetVersion: number; title: string; outputType: LibraryOutputType; sourceCategory: LibrarySourceCategory
  requestedCount: number; generationCost: number; status: 'queued' | 'processing'; attemptCount: number; error: string | null
  createdAt: string; startedAt: string | null; completedAt: string | null; updatedAt: string
}
export type LibraryShareMetadata = { setId: string; title: string; outputType: LibraryOutputType; itemCount: number; version: number; updatedAt: string }

async function libraryFetch<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (authenticated) {
    if (!supabase) throw new AIActionError('authentication_required', 'Sign in to use the library.', 401)
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) throw new AIActionError('authentication_required', 'Sign in to use the library.', 401)
    headers.set('Authorization', `Bearer ${data.session.access_token}`)
  }
  const timeout = AbortSignal.timeout(15_000)
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  const response = await fetch(path, { ...init, headers, signal, cache: 'no-store' })
  const body = await response.json().catch(() => ({})) as T & { error?: string; message?: string; balance?: CreditBalance }
  if (!response.ok) throw new AIActionError(body.error || 'library_failed', body.message || 'The library request failed.', response.status, body.balance)
  return body
}

export function listLibrary() {
  return libraryFetch<{ sets: LibrarySet[]; activeJobs: LibraryJob[]; balance: CreditBalance }>('/api/library?action=list')
}

export function getLibrarySet(setId: string, mode: 'study' | 'edit' = 'study') {
  return libraryFetch<{ set: LibrarySet; items: LibraryItem[]; activeJobs: LibraryJob[]; progress?: LibraryStudyProgress }>(`/api/library?action=set&id=${encodeURIComponent(setId)}&mode=${mode}`)
}

export function gradeLibrarySet(setId: string, answers: Record<string, number>) {
  return libraryFetch<{ score: number; results: Array<{ id: string; correctIndex: number; explanation: string }> }>(`/api/library?action=grade&id=${encodeURIComponent(setId)}`, { method: 'POST', body: JSON.stringify({ answers }) })
}

export function upsertLibraryProgress(setId: string, progress: LibraryStudyProgress, signal?: AbortSignal) {
  return libraryFetch<{ saved: true; progress: LibraryStudyProgress }>(`/api/library?action=progress&id=${encodeURIComponent(setId)}`, { method: 'PUT', body: JSON.stringify({ progress }), signal })
}

export function resetLibraryProgress(setId: string) {
  return libraryFetch<{ progress: LibraryStudyProgress }>(`/api/library?action=progress&id=${encodeURIComponent(setId)}`, { method: 'DELETE' })
}

export function createLibraryGeneration(input: LibraryGenerationRequest, signal?: AbortSignal) {
  return libraryFetch<{ setId: string; jobId: string; reservationId: string; version: number; cost: number; status: string; freeBalance: number; subscriptionBalance: number; purchasedBalance: number }>('/api/library?action=generation', {
    method: 'POST',
    headers: { 'X-Request-ID': crypto.randomUUID() },
    body: JSON.stringify(input),
    signal,
  })
}

export function renameLibrarySet(setId: string, title: string) {
  return libraryFetch<{ set: LibrarySet }>(`/api/library?action=set&id=${encodeURIComponent(setId)}`, { method: 'PATCH', body: JSON.stringify({ title }) })
}

export function deleteLibrarySet(setId: string) {
  return libraryFetch<{ deleted: true }>(`/api/library?action=set&id=${encodeURIComponent(setId)}`, { method: 'DELETE' })
}

export function bulkEditLibraryItems(setId: string, expectedVersion: number, title: string, edits: Array<{ id: string; delete: true } | { id: string; content: LibraryItemContent }>, signal?: AbortSignal) {
  return libraryFetch<{ setId: string; version: number; itemCount: number }>(`/api/library?action=items&id=${encodeURIComponent(setId)}`, { method: 'PATCH', body: JSON.stringify({ expectedVersion, title, edits }), signal })
}

export async function removeLibraryInputs(paths: string[]) {
  if (!supabase || !paths.length) return
  await supabase.storage.from('library-inputs').remove(paths)
}

export async function createLibraryShare(setId: string, expiresAt?: string) {
  const result = await libraryFetch<{ linkId: string; token: string }>('/api/library?action=shares', { method: 'POST', body: JSON.stringify({ setId, expiresAt }) })
  return { ...result, shareUrl: `${window.location.origin}/library/share?token=${encodeURIComponent(result.token)}` }
}

export function revokeLibraryShare(linkId: string) {
  return libraryFetch<{ revoked: true }>('/api/library?action=shares', { method: 'DELETE', body: JSON.stringify({ linkId }) })
}

export function getLibraryShareMetadata(token: string) {
  return libraryFetch<LibraryShareMetadata>(`/api/library?action=share&token=${encodeURIComponent(token)}`, {}, false)
}

export function getSharedLibrarySet(token: string) {
  return libraryFetch<LibraryShareMetadata & { items: LibraryItem[] }>(`/api/library?action=shared&token=${encodeURIComponent(token)}`)
}

export function gradeSharedLibrarySet(token: string, answers: Record<string, number>) {
  return libraryFetch<{ score: number; results: Array<{ id: string; correctIndex: number; explanation: string }> }>(`/api/library?action=shared-grade&token=${encodeURIComponent(token)}`, { method: 'POST', body: JSON.stringify({ answers }) })
}

export async function uploadLibraryInput(file: File, category: 'document' | 'audio', onProgress?: (uploaded: number, total: number) => void) {
  if (!supabase) throw new AIActionError('authentication_required', 'Sign in to upload a source.', 401)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new AIActionError('authentication_required', 'Sign in to upload a source.', 401)
  const allowed: readonly string[] = category === 'document' ? LIBRARY_DOCUMENT_MIME_TYPES : LIBRARY_AUDIO_MIME_TYPES
  if (!allowed.includes(file.type) || file.size < 1 || file.size > LIBRARY_MAX_FILE_BYTES) throw new AIActionError('invalid_file', 'Choose a supported file no larger than 25 MB.', 400)
  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-180) || 'source'
  const storagePath = `${data.user.id}/${crypto.randomUUID()}-${safeName}`
  const upload = await supabase.storage.from('library-inputs').upload(storagePath, file, { contentType: file.type, upsert: false })
  if (upload.error) throw new AIActionError('upload_failed', 'The source file could not be uploaded.', 503)
  onProgress?.(file.size, file.size)
  return { category, storagePath, fileName: file.name.slice(0, 255), mimeType: file.type, byteSize: file.size }
}

import type { MaterialReleaseProgress } from '../types'
import { supabase } from './supabase'

export type ProgressRow = {
  release_id: string
  content_version: string
  read_section_ids: string[]
  practice_answers: Record<string, number>
  practice_submitted: boolean
  updated_at: string
}

function canonicalProgress(progress: MaterialReleaseProgress): MaterialReleaseProgress {
  return {
    ...progress,
    readSectionIds: [...new Set(progress.readSectionIds)].sort(),
    practiceAnswers: Object.fromEntries(Object.entries(progress.practiceAnswers).sort(([a], [b]) => a.localeCompare(b))),
  }
}

function canonicalAnswers(answers: Record<string, number>) {
  return Object.fromEntries(Object.entries(answers).sort(([a], [b]) => a.localeCompare(b)))
}

function mergeEntry(local?: MaterialReleaseProgress, remote?: MaterialReleaseProgress): MaterialReleaseProgress | undefined {
  if (!local) return remote
  if (!remote) return local
  // The server's published content version is authoritative. Local timestamps only
  // resolve edits within that exact version.
  if (local.contentVersion !== remote.contentVersion) return remote
  const localTime = Date.parse(local.updatedAt)
  const remoteTime = Date.parse(remote.updatedAt)
  const localAnswers = canonicalAnswers(local.practiceAnswers)
  const remoteAnswers = canonicalAnswers(remote.practiceAnswers)
  const answers = localTime === remoteTime
    ? JSON.stringify(localAnswers) <= JSON.stringify(remoteAnswers) ? { ...localAnswers, ...remoteAnswers } : { ...remoteAnswers, ...localAnswers }
    : localTime > remoteTime
      ? { ...remoteAnswers, ...localAnswers }
      : { ...localAnswers, ...remoteAnswers }
  return canonicalProgress({
    contentVersion: local.contentVersion,
    readSectionIds: [...remote.readSectionIds, ...local.readSectionIds],
    practiceAnswers: answers,
    practiceSubmitted: local.practiceSubmitted || remote.practiceSubmitted,
    updatedAt: localTime >= remoteTime ? local.updatedAt : remote.updatedAt,
  })
}

export function mergeMaterialProgress(local: Record<string, MaterialReleaseProgress>, remote: Record<string, MaterialReleaseProgress>) {
  return Object.fromEntries([...new Set([...Object.keys(remote), ...Object.keys(local)])].sort().flatMap((releaseId) => {
    const progress = mergeEntry(local[releaseId], remote[releaseId])
    return progress ? [[releaseId, canonicalProgress(progress)]] : []
  }))
}

export function selectDirtyMaterialProgress(progress: Record<string, MaterialReleaseProgress>, dirtyReleaseIds: string[]) {
  return Object.fromEntries([...new Set(dirtyReleaseIds)].sort().flatMap((releaseId) => progress[releaseId] ? [[releaseId, progress[releaseId]]] : []))
}

export function matchingMaterialReleaseIds(local: Record<string, MaterialReleaseProgress>, rows: Array<{ id: string; content_hash: string }>) {
  return rows.filter((row) => local[row.id]?.contentVersion === row.content_hash).map((row) => row.id).sort()
}

export function reconcileDirtyMaterialReleaseIds(compatibleReleaseIds: string[]) {
  return [...new Set(compatibleReleaseIds)].sort()
}

const timeoutSignal = (parent?: AbortSignal) => parent ? AbortSignal.any([parent, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000)

function rowsToProgress(rows: ProgressRow[]) {
  return Object.fromEntries(rows.map((row) => [row.release_id, canonicalProgress({
    contentVersion: row.content_version,
    readSectionIds: row.read_section_ids ?? [],
    practiceAnswers: row.practice_answers ?? {},
    practiceSubmitted: row.practice_submitted,
    updatedAt: row.updated_at,
  })]))
}

export async function hydrateMaterialProgress(signal?: AbortSignal) {
  if (!supabase) return {}
  const { data, error } = await supabase.from('material_learning_progress').select('release_id,content_version,read_section_ids,practice_answers,practice_submitted,updated_at').order('release_id').abortSignal(timeoutSignal(signal))
  if (error) throw error
  return rowsToProgress(data as ProgressRow[])
}

export async function currentMaterialReleaseIds(local: Record<string, MaterialReleaseProgress>, signal?: AbortSignal) {
  if (!supabase) return []
  const releaseIds = Object.keys(local)
  if (releaseIds.length === 0) return []
  const { data, error } = await supabase.from('material_releases').select('id,content_hash').in('id', releaseIds).eq('status', 'published').abortSignal(timeoutSignal(signal))
  if (error) throw error
  return matchingMaterialReleaseIds(local, (data ?? []) as Array<{ id: string; content_hash: string }>)
}

export async function syncMaterialProgress(dirty: Record<string, MaterialReleaseProgress>, signal?: AbortSignal) {
  if (!supabase || Object.keys(dirty).length === 0) return { progress: {}, acknowledgedReleaseIds: [] as string[], failed: false }
  const requestSignal = timeoutSignal(signal)
  const acknowledgedReleaseIds: string[] = []
  let failed = false
  for (const [releaseId, progress] of Object.entries(dirty).sort(([a], [b]) => a.localeCompare(b))) {
    const { error } = await supabase.rpc('merge_material_learning_progress', {
      p_release_id: releaseId,
      p_content_version: progress.contentVersion,
      p_read_section_ids: [...new Set(progress.readSectionIds)].sort(),
      p_practice_answers: Object.fromEntries(Object.entries(progress.practiceAnswers).sort(([a], [b]) => a.localeCompare(b))),
      p_practice_submitted: progress.practiceSubmitted,
      p_updated_at: progress.updatedAt,
    }).abortSignal(requestSignal)
    if (error) failed = true
    else acknowledgedReleaseIds.push(releaseId)
  }
  if (acknowledgedReleaseIds.length === 0) return { progress: {}, acknowledgedReleaseIds, failed }
  const { data, error } = await supabase.from('material_learning_progress').select('release_id,content_version,read_section_ids,practice_answers,practice_submitted,updated_at').in('release_id', acknowledgedReleaseIds).order('release_id').abortSignal(requestSignal)
  if (error) return { progress: {}, acknowledgedReleaseIds, failed: true }
  return { progress: rowsToProgress(data as ProgressRow[]), acknowledgedReleaseIds, failed }
}

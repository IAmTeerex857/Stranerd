import type { MaterialReleaseProgress } from '../types'
import { supabase } from './supabase'

type ProgressRow = {
  release_id: string
  content_version: string
  read_section_ids: string[]
  practice_answers: Record<string, number>
  practice_submitted: boolean
  updated_at: string
}

function mergeEntry(local?: MaterialReleaseProgress, remote?: MaterialReleaseProgress): MaterialReleaseProgress | undefined {
  if (!local) return remote
  if (!remote || local.contentVersion !== remote.contentVersion) return local
  const localNewest = Date.parse(local.updatedAt) >= Date.parse(remote.updatedAt)
  return {
    contentVersion: local.contentVersion,
    readSectionIds: [...new Set([...remote.readSectionIds, ...local.readSectionIds])],
    practiceAnswers: localNewest ? { ...remote.practiceAnswers, ...local.practiceAnswers } : { ...local.practiceAnswers, ...remote.practiceAnswers },
    practiceSubmitted: local.practiceSubmitted || remote.practiceSubmitted,
    updatedAt: localNewest ? local.updatedAt : remote.updatedAt,
  }
}

export function mergeMaterialProgress(local: Record<string, MaterialReleaseProgress>, remote: Record<string, MaterialReleaseProgress>) {
  return Object.fromEntries([...new Set([...Object.keys(remote), ...Object.keys(local)])].flatMap((releaseId) => {
    const progress = mergeEntry(local[releaseId], remote[releaseId])
    return progress ? [[releaseId, progress]] : []
  }))
}

export async function syncMaterialProgress(local: Record<string, MaterialReleaseProgress>) {
  if (!supabase) return local
  const client = supabase
  await Promise.all(Object.entries(local).map(async ([releaseId, progress]) => {
    const { error } = await client.rpc('merge_material_learning_progress', {
      p_release_id: releaseId,
      p_content_version: progress.contentVersion,
      p_read_section_ids: progress.readSectionIds,
      p_practice_answers: progress.practiceAnswers,
      p_practice_submitted: progress.practiceSubmitted,
      p_updated_at: progress.updatedAt,
    })
    if (error) throw error
  }))
  const { data, error } = await client.from('material_learning_progress').select('release_id,content_version,read_section_ids,practice_answers,practice_submitted,updated_at')
  if (error) throw error
  const remote = Object.fromEntries((data as ProgressRow[]).map((row) => [row.release_id, {
    contentVersion: row.content_version,
    readSectionIds: row.read_section_ids ?? [],
    practiceAnswers: row.practice_answers ?? {},
    practiceSubmitted: row.practice_submitted,
    updatedAt: row.updated_at,
  } satisfies MaterialReleaseProgress]))
  return mergeMaterialProgress(local, remote)
}

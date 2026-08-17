import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Config } from './config.js'
import type { LibraryJob, LibrarySource } from './types.js'

export class LibraryDatabase {
  readonly client: SupabaseClient

  constructor(config: Config) {
    this.client = createClient(config.supabaseUrl, config.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-application-name': 'stranerd-library-trigger' } },
    })
  }

  async job(jobId: string): Promise<LibraryJob | undefined> {
    const { data, error } = await this.client.from('library_jobs').select('*').eq('id', jobId).maybeSingle()
    if (error) throw error
    return data as LibraryJob | undefined
  }

  async claimJob(jobId: string): Promise<LibraryJob | undefined> {
    const { error: claimError } = await this.client.rpc('claim_library_job', { p_job_id: jobId })
    if (claimError) {
      if (claimError.code === 'P0001') return undefined
      throw claimError
    }
    return this.job(jobId)
  }

  async sources(jobId: string): Promise<LibrarySource[]> {
    const { data, error } = await this.client.from('library_sources').select('*').eq('job_id', jobId).order('ordinal')
    if (error) throw error
    return (data || []) as LibrarySource[]
  }

  async finalize(jobId: string, items: Record<string, unknown>[]): Promise<void> {
    const { error } = await this.client.rpc('finalize_library_generation', { p_job_id: jobId, p_items: items })
    if (error) throw error
  }

  async setGeneratedTitle(jobId: string, title: string): Promise<void> {
    const { error } = await this.client.from('library_jobs').update({ title }).eq('id', jobId).eq('status', 'processing')
    if (error) throw error
  }

  async retry(jobId: string, errorMessage: string): Promise<void> {
    const { error } = await this.client.from('library_jobs').update({ status: 'queued', error: errorMessage }).eq('id', jobId).eq('status', 'processing')
    if (error) throw error
  }

  async fail(jobId: string, errorMessage: string): Promise<void> {
    const { error } = await this.client.rpc('fail_library_generation', { p_job_id: jobId, p_error: errorMessage })
    if (error) throw error
  }
}

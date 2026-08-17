import type { Config } from './config.js'
import { LibraryDatabase } from './database.js'
import { generateItems, generateStudyTitle, type GenerationContext } from './ai.js'
import { PermanentJobError, safeError } from './errors.js'
import { deleteInputs, ingestSources } from './sources.js'
import type { GeneratedItem, LibraryJob } from './types.js'
import { batches, validRequestedCount } from './validation.js'

interface JobLogger {
  info(message: string): void
  error(message: string): void
}

function itemPayload(item: GeneratedItem): Record<string, unknown> {
  return item.kind === 'flashcard'
    ? { front: item.prompt, back: item.answer }
    : { question: item.prompt, options: item.options, correctIndex: item.options.indexOf(item.answer), explanation: item.explanation }
}

async function execute(config: Config, db: LibraryDatabase, job: LibraryJob): Promise<void> {
  if (!validRequestedCount(job.output_type, job.requested_count)) throw new PermanentJobError('Job has an invalid requested item count')
  const { corpus, sources } = await ingestSources(config, db, job.id)
  const kind = job.output_type === 'flashcards' ? 'flashcard' : 'question'
  const promptOnly = job.source_category === 'prompt'
  const context: GenerationContext = promptOnly
    ? { learningGoal: corpus }
    : { learningGoal: 'Master the central, testable concepts in the supplied material.', referenceMaterial: corpus }
  const title = await generateStudyTitle(config, context)
  await db.setGeneratedTitle(job.id, title)
  const generated: GeneratedItem[] = []
  for (const size of batches(job.requested_count)) {
    const batch = await generateItems(config, { ...context, previousPrompts: generated.map(item => item.prompt) }, size, kind)
    generated.push(...batch)
  }
  await db.finalize(job.id, generated.map(itemPayload))
  try {
    await deleteInputs(db, sources)
  } catch (error) {
    // Finalization settles credits atomically. A cleanup retry must never refund a completed job.
    throw new Error(`Generation completed but input cleanup failed: ${safeError(error)}`, { cause: error })
  }
}

export function isTerminalAttempt(error: unknown, deliveryAttempt: number): boolean {
  return error instanceof PermanentJobError || deliveryAttempt >= 5
}

export async function processLibraryJob(config: Config, jobId: string, deliveryAttempt: number, log: JobLogger): Promise<void> {
  const db = new LibraryDatabase(config)
  const existing = await db.job(jobId)
  if (!existing) {
    log.info(`Library job ${jobId} does not exist`)
    return
  }
  if (existing.status === 'failed' || existing.status === 'completed') {
    await deleteInputs(db, await db.sources(jobId))
    log.info(`Cleaned inputs for ${existing.status} library job ${jobId}`)
    return
  }
  const job = await db.claimJob(jobId)
  if (!job) {
    log.info(`Library job ${jobId} is already terminal`)
    return
  }
  try {
    await execute(config, db, job)
    log.info(`Library job ${job.id} completed`)
  } catch (error) {
    const message = safeError(error)
    if (message.startsWith('Generation completed but input cleanup failed:')) {
      log.error(message)
      throw error
    }
    if (isTerminalAttempt(error, deliveryAttempt)) {
      await db.fail(job.id, message)
      await deleteInputs(db, await db.sources(job.id))
      log.error(`Library job ${job.id} failed permanently: ${message}`)
      return
    }
    await db.retry(job.id, message)
    throw error
  }
}

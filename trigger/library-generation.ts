import { logger, task } from '@trigger.dev/sdk'
import { loadConfig } from './library/config.js'
import { processLibraryJob } from './library/processor.js'
import { parseQueueMessage } from './library/validation.js'

export const libraryGeneration = task({
  id: 'library-generation',
  queue: { concurrencyLimit: 1 },
  maxDuration: 600,
  retry: {
    maxAttempts: 5,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: { jobId: string }, { ctx }) => {
    const message = parseQueueMessage(payload)
    if (!message) {
      logger.error('Discarding malformed library-generation payload')
      return
    }
    await processLibraryJob(loadConfig(), message.jobId, ctx.attempt.number, {
      info: (message) => logger.info(message),
      error: (message) => logger.error(message),
    })
  },
})

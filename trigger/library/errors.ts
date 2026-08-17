export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermanentJobError'
  }
}

export function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown processing error'
  return message.replace(/(api[-_ ]?key|authorization|token|secret)\s*[:=]\s*\S+/gi, '$1=[redacted]').slice(0, 1000)
}

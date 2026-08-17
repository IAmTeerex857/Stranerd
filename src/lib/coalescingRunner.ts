export type CoalescingRunner = {
  request: () => Promise<void>
  flush: () => Promise<void>
  dispose: () => void
}

export function createCoalescingRunner(task: () => Promise<void>, debounceMs = 0): CoalescingRunner {
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let requested = false
  let disposed = false
  let waiters: Array<{ resolve: () => void; reject: (error: unknown) => void }> = []

  const run = async () => {
    if (running || disposed) return
    running = true
    let failure: unknown
    try {
      while (requested && !disposed) {
        requested = false
        try {
          await task()
        } catch (error) {
          failure = error
        }
      }
    } finally {
      running = false
      const settled = waiters
      waiters = []
      for (const waiter of settled) {
        if (failure === undefined) waiter.resolve()
        else waiter.reject(failure)
      }
    }
  }

  return {
    request() {
      if (disposed) return Promise.reject(new Error('Sync runner is disposed.'))
      requested = true
      if (!running) {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
          timer = undefined
          void run()
        }, debounceMs)
      }
      return new Promise<void>((resolve, reject) => waiters.push({ resolve, reject }))
    },
    flush() {
      if (disposed) return Promise.reject(new Error('Sync runner is disposed.'))
      if (timer) clearTimeout(timer)
      timer = undefined
      if (!requested && !running) return Promise.resolve()
      const pending = new Promise<void>((resolve, reject) => waiters.push({ resolve, reject }))
      void run()
      return pending
    },
    dispose() {
      disposed = true
      requested = false
      if (timer) clearTimeout(timer)
      timer = undefined
      const error = new Error('Sync runner is disposed.')
      for (const waiter of waiters) waiter.reject(error)
      waiters = []
    },
  }
}

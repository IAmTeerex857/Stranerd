import { describe, expect, it, vi } from 'vitest'
import { createCoalescingRunner } from './coalescingRunner'

describe('coalescing sync runner', () => {
  it('debounces a burst into one run', async () => {
    vi.useFakeTimers()
    const task = vi.fn(async () => undefined)
    const runner = createCoalescingRunner(task, 200)
    const requests = [runner.request(), runner.request(), runner.request()]
    await vi.advanceTimersByTimeAsync(200)
    await Promise.all(requests)
    expect(task).toHaveBeenCalledTimes(1)
    runner.dispose()
    vi.useRealTimers()
  })

  it('allows only one run at a time and coalesces a trailing request', async () => {
    let releaseFirst!: () => void
    let active = 0
    let maximumActive = 0
    const task = vi.fn(async () => {
      active += 1
      maximumActive = Math.max(maximumActive, active)
      if (task.mock.calls.length === 1) await new Promise<void>((resolve) => { releaseFirst = resolve })
      active -= 1
    })
    const runner = createCoalescingRunner(task)
    const first = runner.request()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const trailing = [runner.request(), runner.request()]
    releaseFirst()
    await Promise.all([first, ...trailing])
    expect(task).toHaveBeenCalledTimes(2)
    expect(maximumActive).toBe(1)
    runner.dispose()
  })

  it('flushes pending debounced work immediately', async () => {
    vi.useFakeTimers()
    const task = vi.fn(async () => undefined)
    const runner = createCoalescingRunner(task, 10_000)
    const requested = runner.request()
    await runner.flush()
    await requested
    expect(task).toHaveBeenCalledOnce()
    runner.dispose()
    vi.useRealTimers()
  })
})

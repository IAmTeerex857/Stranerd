import { describe, expect, it } from 'vitest'
import { VOICE_EXTENSION_LEAD_MS, voiceRenewalDelay } from './realtime'

describe('Voice renewal timing', () => {
  it('renews thirty seconds before the paid block ends', () => {
    expect(voiceRenewalDelay(300_000, 0)).toBe(300_000 - VOICE_EXTENSION_LEAD_MS)
  })

  it('renews immediately when already inside the renewal window', () => {
    expect(voiceRenewalDelay(20_000, 0)).toBe(0)
  })
})

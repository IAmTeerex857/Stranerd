import { describe, expect, it } from 'vitest'
import { azureRealtimeCallsUrl, realtimeVoiceInstructions } from '../api/realtime/session.js'
import { validVoiceEndEvent } from '../api/realtime/end.js'

describe('Azure Realtime session URL', () => {
  it('uses the GA calls endpoint without the WebRTC filter', () => {
    expect(azureRealtimeCallsUrl('https://example.openai.azure.com/')).toBe('https://example.openai.azure.com/openai/v1/realtime/calls')
    expect(azureRealtimeCallsUrl('https://example.openai.azure.com/')).not.toContain('webrtcfilter')
  })
})

describe('Realtime Voice instructions', () => {
  it('defines automatic and unambiguous high-level dissection behavior', () => {
    const instructions = realtimeVoiceInstructions({ id: 'digestive' }, { screen: 'mentor' })
    expect(instructions).toContain('automatically activate Dissect Mode')
    expect(instructions).toContain('use viewer_dissection isolate, never viewer_settings')
    expect(instructions).toContain('two or more named structures')
    expect(instructions).toContain('use restore with an empty structureIds array')
  })
})

describe('Voice lifecycle events', () => {
  it('accepts bounded authenticated session end states only', () => {
    const sessionId = '123e4567-e89b-42d3-a456-426614174000'
    expect(validVoiceEndEvent({ sessionId, status: 'expired', reason: 'expired' })).toBe(true)
    expect(validVoiceEndEvent({ sessionId, status: 'issued', reason: 'hidden' })).toBe(false)
    expect(validVoiceEndEvent({ sessionId, status: 'failed', reason: '' })).toBe(false)
  })
})

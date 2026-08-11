import { describe, expect, it } from 'vitest'
import { azureRealtimeCallsUrl } from './session.js'

describe('Azure Realtime session URL', () => {
  it('uses the GA calls endpoint without the WebRTC filter', () => {
    expect(azureRealtimeCallsUrl('https://example.openai.azure.com/')).toBe('https://example.openai.azure.com/openai/v1/realtime/calls')
    expect(azureRealtimeCallsUrl('https://example.openai.azure.com/')).not.toContain('webrtcfilter')
  })
})

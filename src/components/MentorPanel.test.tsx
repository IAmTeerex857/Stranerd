// @vitest-environment jsdom

import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatItem, ModelEntry } from '../types'
import type { VoiceCore } from '../lib/useVoiceCore'
import { MentorPanel } from './MentorPanel'

const askMentor = vi.hoisted(() => vi.fn())

vi.mock('../lib/mentor', () => ({ askMentor }))
vi.mock('../auth-context', () => ({ useAuth: () => ({ user: { id: 'student-1' }, setBalance: vi.fn() }) }))
vi.mock('./VoiceDock', () => ({ VoiceDock: () => null }))
vi.mock('../lib/bodyScrollLock', () => ({ useBodyScrollLock: () => undefined }))

const model = { id: 'heart', name: 'Heart', system: 'cardiovascular', facts: [] } as unknown as ModelEntry
const voice = { muted: false } as VoiceCore

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Harness() {
  const [messages, setMessages] = useState<ChatItem[]>([])
  const [typing, setTyping] = useState(false)
  return <MentorPanel model={model} actionHistory={[]} messages={messages} typing={typing} onMessages={setMessages} onTyping={setTyping} noteRequest={{ id: 'selection-1', prompt: 'Explain the selected passage.' }} voice={voice} />
}

describe('MentorPanel note requests', () => {
  beforeEach(() => {
    askMentor.mockReset()
    askMentor.mockResolvedValue({ message: 'A grounded answer.', balance: {} })
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { callback(0); return 1 })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    HTMLElement.prototype.scrollTo = vi.fn()
  })

  afterEach(() => vi.restoreAllMocks())

  it('submits a selected-note request once instead of leaving it as a draft', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<Harness />)
      await new Promise((resolve) => window.setTimeout(resolve, 20))
    })

    expect(askMentor).toHaveBeenCalledTimes(1)
    expect(askMentor).toHaveBeenCalledWith('Explain the selected passage.', expect.any(Object))
    expect(container.textContent).toContain('Explain the selected passage.')
    expect(container.textContent).toContain('A grounded answer.')

    await act(async () => root.unmount())
    container.remove()
  })
})

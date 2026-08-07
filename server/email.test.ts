import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmailError, sendWelcomeEmail, welcomeEmail } from './email.js'

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.RESEND_API_KEY
  delete process.env.EMAIL_FROM
  delete process.env.EMAIL_REPLY_TO
})

describe('welcome email', () => {
  it('escapes profile data and uses a monochrome template', () => {
    const email = welcomeEmail({ email: 'learner@example.com', user_metadata: { name: '<script>alert(1)</script>' } })
    expect(email.subject).toBe('Welcome to Stranerd')
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(email.html).not.toContain('<script>alert(1)</script>')
    expect(email.html).not.toMatch(/border-left:\s*[2-9]px/i)
  })

  it('sends through Resend with the configured sender and reply-to', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_FROM = 'Stranerd <hello@stranerd.com>'
    process.env.EMAIL_REPLY_TO = 'support@example.com'
    const fetchMock = vi.fn(async (...requestArgs: Parameters<typeof fetch>) => {
      void requestArgs
      return new Response(JSON.stringify({ id: 'email-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendWelcomeEmail({ email: 'learner@example.com', user_metadata: { name: 'Ada' } } as never)).resolves.toBe('email-1')
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(request).toMatchObject({ from: 'Stranerd <hello@stranerd.com>', to: ['learner@example.com'], reply_to: 'support@example.com' })
  })

  it('rejects incomplete Resend responses', async () => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.EMAIL_FROM = 'Stranerd <hello@stranerd.com>'
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })))
    await expect(sendWelcomeEmail({ email: 'learner@example.com', user_metadata: {} } as never)).rejects.toBeInstanceOf(EmailError)
  })
})

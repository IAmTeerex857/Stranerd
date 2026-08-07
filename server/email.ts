import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export class EmailError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

let serviceClient: SupabaseClient | undefined

export function setEmailClientForTests(client?: SupabaseClient) {
  serviceClient = client
}

export function getEmailClient() {
  if (serviceClient) return serviceClient
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new EmailError(503, 'server_not_configured', 'Email account services are not configured.')
  serviceClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return serviceClient
}

export async function requireEmailUser(authorization?: string): Promise<User> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) throw new EmailError(401, 'authentication_required', 'Sign in to send account emails.')
  const { data, error } = await getEmailClient().auth.getUser(token)
  if (error || !data.user) throw new EmailError(401, 'invalid_session', 'Your session is invalid or expired.')
  return data.user
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
}

export function welcomeEmail(user: Pick<User, 'email' | 'user_metadata'>) {
  const rawName = user.user_metadata.full_name || user.user_metadata.name || user.email?.split('@')[0] || 'there'
  const firstName = escapeHtml(String(rawName).trim().split(/\s+/)[0] || 'there')
  const appUrl = `${(process.env.APP_BASE_URL || 'https://learn.stranerd.com').replace(/\/$/, '')}/app`
  return {
    subject: 'Welcome to Stranerd',
    text: `Welcome to Stranerd, ${String(rawName).trim().split(/\s+/)[0] || 'there'}. Your anatomy workspace is ready. Explore models, work through dissections, take assessments, and use your 20 welcome credits when AI adds value. Open Stranerd: ${appUrl}`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Welcome to Stranerd</title></head>
<body style="margin:0;background:#000000;color:#f7f8fa;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#000000"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border:1px solid #292929;background:#070707">
      <tr><td style="padding:26px 30px;border-bottom:1px solid #292929"><div style="font-size:24px;font-weight:700;letter-spacing:-1px;color:#ffffff">Stranerd</div><div style="margin-top:5px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#858585">Interactive anatomy</div></td></tr>
      <tr><td style="padding:48px 30px 26px"><div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a5a5a5">Your anatomy workspace is ready</div><h1 style="margin:18px 0 18px;font-size:46px;line-height:1;letter-spacing:-2.5px;font-weight:500;color:#ffffff">Welcome, ${firstName}.</h1><p style="margin:0;max-width:500px;font-size:17px;line-height:1.65;color:#b3b3b3">Explore anatomy in three dimensions, pull structures apart, test your understanding, and ask AI only when it adds value.</p></td></tr>
      <tr><td style="padding:10px 30px 30px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #292929;background:#0c0c0c"><tr><td style="padding:18px"><div style="font-size:32px;line-height:1;color:#ffffff">20</div><div style="margin-top:7px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#898989">Welcome credits</div></td><td style="padding:18px;border-left:1px solid #292929;font-size:13px;line-height:1.6;color:#a7a7a7">Use credits for Mentor, assessment hints, corrections, or a fresh assessment. Every cost is shown before you act.</td></tr></table></td></tr>
      <tr><td style="padding:0 30px 48px"><a href="${appUrl}" style="display:inline-block;padding:15px 22px;background:#ffffff;color:#000000;text-decoration:none;font-size:14px;font-weight:700">Open your anatomy lab&nbsp;&nbsp;→</a></td></tr>
      <tr><td style="padding:22px 30px;border-top:1px solid #292929;font-size:11px;line-height:1.6;color:#737373">Stranerd Academy Limited<br>This is an educational study tool, not medical advice.</td></tr>
    </table>
  </td></tr></table>
</body></html>`,
  }
}

export async function sendWelcomeEmail(user: User) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const replyTo = process.env.EMAIL_REPLY_TO
  if (!apiKey || !from) throw new EmailError(503, 'resend_not_configured', 'Welcome email delivery is not configured.')
  if (!user.email) throw new EmailError(400, 'email_missing', 'The signed-in account does not have an email address.')

  const email = welcomeEmail(user)
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `welcome/${user.id}` },
    body: JSON.stringify({ from, to: [user.email], reply_to: replyTo || undefined, ...email }),
    signal: AbortSignal.timeout(20_000),
  })
  const body = await response.json().catch(() => ({})) as { id?: string; message?: string }
  if (!response.ok || !body.id) throw new EmailError(502, 'resend_failed', body.message || 'The welcome email could not be sent.')
  return body.id
}

export function emailErrorResponse(error: unknown) {
  if (error instanceof EmailError) return { status: error.status, body: { error: error.code, message: error.message } }
  console.error('Email request failed:', error instanceof Error ? error.message : error)
  return { status: 500, body: { error: 'internal_error', message: 'The email could not be sent.' } }
}

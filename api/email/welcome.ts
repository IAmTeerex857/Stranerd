import type { Request, Response } from 'express'
import { emailErrorResponse, getEmailClient, requireEmailUser, sendWelcomeEmail } from '../../server/email.js'

const NEW_ACCOUNT_WINDOW_MS = 15 * 60 * 1000

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed' })
    return
  }

  let userId: string | undefined
  let providerId: string | undefined
  try {
    const user = await requireEmailUser(request.headers.authorization)
    userId = user.id
    const createdAt = Date.parse(user.created_at)
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > NEW_ACCOUNT_WINDOW_MS) {
      response.json({ sent: false, reason: 'existing_account' })
      return
    }

    const client = getEmailClient()
    const { data: claimed, error: claimError } = await client.rpc('claim_account_email', { p_user_id: user.id, p_template: 'welcome' })
    if (claimError) throw claimError
    if (!claimed) {
      response.json({ sent: false, reason: 'already_processed' })
      return
    }

    providerId = await sendWelcomeEmail(user)
    let { error: finishError } = await client.rpc('finish_account_email', { p_user_id: user.id, p_template: 'welcome', p_status: 'sent', p_provider_id: providerId, p_error: null })
    if (finishError) ({ error: finishError } = await client.rpc('finish_account_email', { p_user_id: user.id, p_template: 'welcome', p_status: 'sent', p_provider_id: providerId, p_error: null }))
    if (finishError) throw finishError
    response.json({ sent: true })
  } catch (error) {
    if (userId && !providerId) {
      await getEmailClient().rpc('finish_account_email', { p_user_id: userId, p_template: 'welcome', p_status: 'failed', p_provider_id: null, p_error: error instanceof Error ? error.message.slice(0, 500) : 'delivery failed' })
    }
    const result = emailErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

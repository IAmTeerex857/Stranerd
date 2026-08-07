import type { Request, Response } from 'express'
import { getMentorReply, type MentorRequest } from '../server/mentor.js'
import { aiErrorResponse, configuredAiProvider, runCreditProtected } from '../server/aiCredits.js'

export default async function handler(request: Request, response: Response) {
  if (request.method !== 'POST') {
    response.status(405).json({ message: 'Method not allowed' })
    return
  }

  try {
    if (JSON.stringify(request.body || {}).length > 32_768) {
      response.status(413).json({ error: 'request_too_large', message: 'The AI request is too large.' })
      return
    }
    const body = request.body as MentorRequest
    if (typeof body?.question !== 'string' || !body.question.trim() || body.question.length > 500 || !body.context || typeof body.context !== 'object') {
      response.status(400).json({ error: 'invalid_request', message: 'A question and anatomy context are required.' })
      return
    }
    const provider = configuredAiProvider()
    const trustedIp = process.env.VERCEL === '1'
      ? request.headers['x-vercel-forwarded-for']?.toString().split(',')[0]?.trim()
      : request.ip || request.socket?.remoteAddress
    const result = await runCreditProtected({ authorization: request.headers.authorization, requestId: request.headers['x-request-id'] as string | undefined, feature: 'mentor', provider, model: provider === 'azure-openai' ? process.env.AZURE_OPENAI_DEPLOYMENT : process.env.OPENAI_MODEL || 'gpt-5-mini', clientIp: trustedIp }, async () => {
      const reply = await getMentorReply({ question: body.question, context: body.context })
      return { value: { message: reply.message }, source: reply.source, successful: reply.source !== 'offline' && Boolean(reply.message.trim()) }
    })
    response.json({ ...result.value, source: result.source, balance: result.balance })
  } catch (error) {
    const result = aiErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

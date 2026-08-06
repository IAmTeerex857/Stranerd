import type { Request, Response } from 'express'
import { generateQuizSet, type QuizGenerationRequest } from '../server/quiz.js'
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
    const body = request.body as QuizGenerationRequest
    if (typeof body?.modelId !== 'string' || !body.modelId.trim() || typeof body.model !== 'string' || !body.model.trim()) {
      response.status(400).json({ error: 'invalid_request', message: 'A valid anatomy model is required.' })
      return
    }
    const provider = configuredAiProvider()
    const trustedIp = request.headers['x-vercel-forwarded-for']?.toString().split(',')[0]?.trim() || (process.env.NODE_ENV === 'production' ? undefined : request.ip || request.socket?.remoteAddress)
    const result = await runCreditProtected({ authorization: request.headers.authorization, requestId: request.headers['x-request-id'] as string | undefined, feature: 'ai_quiz', provider, model: provider === 'azure-openai' ? process.env.AZURE_OPENAI_DEPLOYMENT : process.env.OPENAI_MODEL || 'gpt-5-mini', clientIp: trustedIp }, async () => {
      const generated = await generateQuizSet(body)
      return { value: { quizzes: generated.quizzes }, source: generated.source, successful: Array.isArray(generated.quizzes) && generated.quizzes.length === 20 }
    })
    response.json({ ...result.value, source: result.source, balance: result.balance })
  } catch (error) {
    const result = aiErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}

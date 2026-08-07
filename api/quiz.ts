import type { Request, Response } from 'express'
import { generateQuizCorrections, generateQuizHint, generateQuizSet, type QuizGenerationRequest } from '../server/quiz.js'
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
    const action = body.action || 'generate'
    if (!['generate', 'hint', 'corrections'].includes(action)) {
      response.status(400).json({ error: 'invalid_request', message: 'A valid assessment action is required.' })
      return
    }
    if (action === 'hint' && (!body.quiz || typeof body.quiz.question !== 'string' || !Array.isArray(body.quiz.options))) {
      response.status(400).json({ error: 'invalid_request', message: 'A valid assessment question is required.' })
      return
    }
    if (action === 'corrections' && (!Array.isArray(body.quizzes) || body.quizzes.length !== 20 || !Array.isArray(body.answers) || body.answers.length !== 20)) {
      response.status(400).json({ error: 'invalid_request', message: 'A completed 20-question assessment is required.' })
      return
    }
    const provider = configuredAiProvider()
    const trustedIp = request.headers['x-vercel-forwarded-for']?.toString().split(',')[0]?.trim() || (process.env.NODE_ENV === 'production' ? undefined : request.ip || request.socket?.remoteAddress)
    const amount = action === 'generate' ? 5 : action === 'corrections' ? 2 : 1
    const result = await runCreditProtected<Record<string, unknown>>({ authorization: request.headers.authorization, requestId: request.headers['x-request-id'] as string | undefined, feature: 'ai_quiz', amount, provider, model: provider === 'azure-openai' ? process.env.AZURE_OPENAI_DEPLOYMENT : process.env.OPENAI_MODEL || 'gpt-5-mini', clientIp: trustedIp }, async () => {
      if (action === 'hint') {
        const generated = await generateQuizHint(body)
        return { value: { hint: generated.hint }, source: generated.source, successful: Boolean(generated.hint) }
      }
      if (action === 'corrections') {
        const generated = await generateQuizCorrections(body)
        return { value: { corrections: generated.corrections }, source: generated.source, successful: Array.isArray(generated.corrections) && generated.corrections.length === 20 }
      }
      const generated = await generateQuizSet(body)
      return { value: { quizzes: generated.quizzes }, source: generated.source, successful: Array.isArray(generated.quizzes) && generated.quizzes.length === 20 }
    })
    response.json({ ...result.value, source: result.source, balance: result.balance })
  } catch (error) {
    const result = aiErrorResponse(error)
    response.status(result.status).json(result.body)
  }
}
